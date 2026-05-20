const db = require('./db');

const MEDIA_360_IMAGE = '360_image';
const MEDIA_STILL_IMAGE = 'still_image';
const MEDIA_LOCAL_VIDEO = 'local_video';
const MEDIA_YOUTUBE_VIDEO = 'youtube_video';
const MEDIA_VIMEO_VIDEO = 'vimeo_video';

function normalizeMediaKind(room) {
  const kind = String(room.media_kind || '').trim();
  if ([MEDIA_360_IMAGE, MEDIA_STILL_IMAGE, MEDIA_LOCAL_VIDEO, MEDIA_YOUTUBE_VIDEO, MEDIA_VIMEO_VIDEO].includes(kind)) return kind;
  return room.image_path ? MEDIA_360_IMAGE : MEDIA_360_IMAGE;
}

function getLocalMediaPath(room) {
  return room.media_path || room.image_path || null;
}

function roomHasRenderableMedia(room) {
  const kind = normalizeMediaKind(room);
  if (kind === MEDIA_YOUTUBE_VIDEO || kind === MEDIA_VIMEO_VIDEO) {
    return !!room.media_embed_url;
  }
  return !!getLocalMediaPath(room);
}

function buildTourData(tourSlug) {
  const tour = db.prepare('SELECT * FROM tours WHERE slug = ?').get(tourSlug);
  if (!tour) return null;

  const rooms = db.prepare(`
    SELECT * FROM rooms WHERE tour_id = ?
    ORDER BY sort_order ASC, created_at ASC
  `).all(tour.id);

  const hotspots = db.prepare(`
    SELECT h.*, r.name AS to_name
    FROM hotspots h
    JOIN rooms r ON r.id = h.to_room_id
    WHERE h.from_room_id IN (SELECT id FROM rooms WHERE tour_id = ?)
  `).all(tour.id);

  const infoPoints = db.prepare(`
    SELECT ip.*
    FROM info_points ip
    WHERE ip.room_id IN (SELECT id FROM rooms WHERE tour_id = ?)
  `).all(tour.id);

  const scenesObj = {};
  const roomDataObj = {};
  const sceneRoomIds = new Set(
    rooms
      .filter(r => normalizeMediaKind(r) === MEDIA_360_IMAGE && !!getLocalMediaPath(r))
      .map(r => r.id)
  );
  for (const room of rooms) {
    const media_kind = normalizeMediaKind(room);
    const media_path = getLocalMediaPath(room);
    const roomHotspots = hotspots.filter(h => h.from_room_id === room.id);
    const roomInfoPoints = infoPoints.filter(ip => ip.room_id === room.id);

    roomDataObj['room-' + room.id] = {
      id: room.id,
      name: room.name,
      media_kind,
      media_path: media_path ? ('/' + media_path) : null,
      media_embed_url: room.media_embed_url || null,
      initial_pitch: room.initial_pitch,
      initial_yaw: room.initial_yaw,
      hotspots: roomHotspots.map(h => ({
        id: h.id,
        to_room_id: h.to_room_id,
        to_name: h.to_name,
        pitch: h.pitch,
        yaw: h.yaw,
        text: h.text || ''
      })),
      info_points: roomInfoPoints.map(ip => ({
        id: ip.id,
        pitch: ip.pitch,
        yaw: ip.yaw,
        x_percent: ip.x_percent,
        y_percent: ip.y_percent,
        title: ip.title || '',
        text: ip.text || ''
      }))
    };

    if (media_kind !== MEDIA_360_IMAGE || !media_path) continue;

    const sceneHotspots = hotspots
      .filter(h => h.from_room_id === room.id && sceneRoomIds.has(h.to_room_id))
      .map(h => ({
        pitch: h.pitch,
        yaw: h.yaw,
        type: 'scene',
        text: h.text || h.to_name,
        sceneId: 'room-' + h.to_room_id
      }));
    const infoHotspots = roomInfoPoints
      .filter(ip => ip.pitch != null && ip.yaw != null)
      .map(ip => ({
        pitch: ip.pitch,
        yaw: ip.yaw,
        type: 'info',
        text: [ip.title, ip.text].filter(Boolean).join(' — ') || 'Info'
      }));

    scenesObj['room-' + room.id] = {
      title: room.name,
      type: 'equirectangular',
      panorama: '/' + media_path,
      pitch: room.initial_pitch,
      yaw: room.initial_yaw,
      hotSpots: [...sceneHotspots, ...infoHotspots]
    };
  }

  const defaultRoom = rooms.find(r => r.is_default && roomHasRenderableMedia(r)) || rooms.find(r => roomHasRenderableMedia(r));
  const firstRoomId = defaultRoom ? defaultRoom.id : null;
  const firstScene = defaultRoom && scenesObj['room-' + defaultRoom.id] ? ('room-' + defaultRoom.id) : null;

  return { tour, rooms, hotspots, infoPoints, scenesObj, roomDataObj, firstScene, firstRoomId, defaultRoom };
}

module.exports = { buildTourData };
