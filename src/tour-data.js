const db = require('./db');

const MEDIA_360_IMAGE = '360_image';
const MEDIA_STILL_IMAGE = 'still_image';
const MEDIA_LOCAL_VIDEO = 'local_video';
const MEDIA_YOUTUBE_VIDEO = 'youtube_video';
const MEDIA_VIMEO_VIDEO = 'vimeo_video';
const MEDIA_EMBED = 'embed';

function normalizeMediaKind(room) {
  const kind = String(room.media_kind || '').trim();
  if ([MEDIA_360_IMAGE, MEDIA_STILL_IMAGE, MEDIA_LOCAL_VIDEO, MEDIA_YOUTUBE_VIDEO, MEDIA_VIMEO_VIDEO, MEDIA_EMBED].includes(kind)) return kind;
  return MEDIA_360_IMAGE;
}

function getLocalMediaPath(room) {
  return room.media_path || room.image_path || null;
}

function normalizeHttpUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch (e) {
    return null;
  }
}

function roomHasRenderableMedia(room) {
  const kind = normalizeMediaKind(room);
  if (kind === MEDIA_YOUTUBE_VIDEO || kind === MEDIA_VIMEO_VIDEO || kind === MEDIA_EMBED) {
    return !!room.media_embed_url;
  }
  return !!getLocalMediaPath(room);
}

// Tours list with room counts and a cover image fallback, shared by the public
// page and the JSON API so the two can never drift.
function listTours() {
  return db.prepare(`
    SELECT t.*,
      COUNT(r.id) AS room_count,
      COALESCE(
        t.cover_image_path,
        (SELECT r2.image_path FROM rooms r2 WHERE r2.tour_id = t.id AND r2.is_default = 1 AND r2.image_path IS NOT NULL LIMIT 1),
        (SELECT r3.image_path FROM rooms r3 WHERE r3.tour_id = t.id AND r3.image_path IS NOT NULL ORDER BY r3.sort_order ASC, r3.created_at ASC LIMIT 1)
      ) AS cover_image
    FROM tours t
    LEFT JOIN rooms r ON r.tour_id = t.id
    GROUP BY t.id
    ORDER BY t.created_at DESC
  `).all();
}

function groupBy(rows, key) {
  const map = new Map();
  for (const row of rows) {
    const list = map.get(row[key]);
    if (list) list.push(row);
    else map.set(row[key], [row]);
  }
  return map;
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
    LEFT JOIN rooms r ON r.id = h.to_room_id
    WHERE h.from_room_id IN (SELECT id FROM rooms WHERE tour_id = ?)
  `).all(tour.id);

  const infoPoints = db.prepare(`
    SELECT ip.*
    FROM info_points ip
    WHERE ip.room_id IN (SELECT id FROM rooms WHERE tour_id = ?)
  `).all(tour.id);

  // Group once so each room looks up only its own rows instead of filtering
  // the full hotspot/info-point list per room.
  const hotspotsByRoom = groupBy(hotspots, 'from_room_id');
  const infoPointsByRoom = groupBy(infoPoints, 'room_id');

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
    const media_embed_url = normalizeHttpUrl(room.media_embed_url);
    const roomHotspots = hotspotsByRoom.get(room.id) || [];
    const roomInfoPoints = infoPointsByRoom.get(room.id) || [];

    roomDataObj['room-' + room.id] = {
      id: room.id,
      name: room.name,
      media_kind,
      media_path: media_path ? ('/' + media_path) : null,
      media_embed_url,
      initial_pitch: room.initial_pitch,
      initial_yaw: room.initial_yaw,
      default_hfov: room.default_hfov,
      auto_rotate: !!room.auto_rotate,
      auto_rotate_speed: room.auto_rotate_speed || 1.0,
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

    const sceneHotspots = roomHotspots
      .filter(h => sceneRoomIds.has(h.to_room_id))
      .map(h => ({
        pitch: h.pitch,
        yaw: h.yaw,
        type: 'scene',
        text: h.text || h.to_name,
        sceneId: 'room-' + h.to_room_id
      }));
    const externalHotspots = roomHotspots
      .map(h => ({ ...h, safeUrl: normalizeHttpUrl(h.url) }))
      .filter(h => h.is_external && h.safeUrl)
      .map(h => ({
        pitch: h.pitch,
        yaw: h.yaw,
        type: 'info',
        text: h.text || 'External Link',
          URL: h.safeUrl
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
      hotSpots: [...sceneHotspots, ...externalHotspots, ...infoHotspots]
    };
  }

  const defaultRoom = rooms.find(r => r.is_default && roomHasRenderableMedia(r)) || rooms.find(r => roomHasRenderableMedia(r));
  const firstRoomId = defaultRoom ? defaultRoom.id : null;
  const firstScene = defaultRoom && scenesObj['room-' + defaultRoom.id] ? ('room-' + defaultRoom.id) : null;

  return { tour, rooms, hotspots, infoPoints, scenesObj, roomDataObj, firstScene, firstRoomId, defaultRoom };
}

module.exports = { buildTourData, listTours };
