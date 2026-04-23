const express = require('express');
const path = require('path');
const methodOverride = require('method-override');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', require('./src/routes/index'));
app.use('/tour', require('./src/routes/tours'));
app.use('/dashboard', require('./src/routes/dashboard'));

app.use((req, res) => {
  res.status(404).render('error', { title: 'Not Found', status: 404, message: 'Page not found' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', { title: 'Error', status: 500, message: err.message || 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`Tourbine running at http://localhost:${PORT}`);
  console.log(`Dashboard: http://localhost:${PORT}/dashboard`);
});
