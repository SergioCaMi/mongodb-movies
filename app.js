//Express
const express = require("express");
const app = express();

// Middleware para parsear application/json
app.use(express.json());

// Middleware para parsear application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));

//importamos path para manejar rutas de archivos
const path = require("path");

// Importar MongoClient de mongodb
const { MongoClient } = require("mongodb");
const uri =
  "mongodb+srv://sergiocami84:Msg--300183@cluster0.mo4mc0w.mongodb.net/?retryWrites=true&w=majority";
const client = new MongoClient(uri);

//Morgan es un middleware de logging para Express
const morgan = require("morgan"); // Importar morgan para logging
app.use(morgan("dev"));

//Configurar puerto
const PORT = process.env.PORT || 3000;

// Middleware para parsear JSON
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// Configurar EJS como motor de plantillas
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Conectar a la base de datos al iniciar el servidor
bdConect();

// ******************** Rutas ********************
app.get("/", async (req, res) => {
  const db = client.db("sample_mflix");
  const collection = db.collection("movies");
  //  const movies = await collection.find().limit(10).sort({released: -1}).toArray();
  const cursor = collection.find().sort({ released: -1 }).limit(10);
  const movies = [];
  while (await cursor.hasNext()) {
    // Recorremos el cursor si hay más documentos
    const doc = await cursor.next(); // Obtenemos el siguiente documento
    movies.push(doc); // Añadimos el documento al array
  }
  res.render("index.ejs", {
    movies: movies,
    title: "Movies",
  });
});

app.post("/movies", async (req, res) => {
  console.log(req.body);
  const db = client.db("sample_mflix");
  const collection = db.collection("movies");
  const { keyword, genre, type, startYear, endYear, minRating, maxRating } =
    req.body;
  let query = {};
// let sorted = `{ released: ${Number(req.body.sort)} }`;
let sorted = { released: Number(req.body.sort) };
console.log('Sort', sorted);
  if (keyword) {
    query.title = { $regex: keyword, $options: "i" }; // Búsqueda insensible a mayúsculas y minúsculas
  }

  if (genre) {
    query.genres = genre;
  }

  if (type) {
    query.type = type;
  }

  if (startYear && endYear) {
    query.released = { $gte: parseInt(startYear), $lte: parseInt(endYear) };
  }

  if (minRating && maxRating) {
    query["imdb.rating"] = {
      $gte: parseFloat(minRating),
      $lte: parseFloat(maxRating),
    };
  }

const cursor = collection.find(query).sort(sorted).limit(10);
  const movies = [];
  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    movies.push(doc);
  }
  res.render("index.ejs", {
    movies: movies,
    title: "Movies",
  });
});

// Ruta 404 para endpoints no definidos
app.use((req, res) => {
  res.status(404).send("Ruta no encontrada");
});

app.use((err, req, res, next) => {
  console.error(err);
  res
    .status(500)
    .send(
      '<p>Ups! La operación ha fallado. Hemos informado a los desarrolladores. Vuelve a probarlo más tarde.Vuelve a la <a href="/">home page</a></p> '
    );
});

// ********** Funciones **********
async function bdConect() {
  try {
    await client.connect();
    console.log("Conectado a la base de datos");

    // Levantar el servidor
    app.listen(PORT, () => {
      console.log(`Servidor escuchando en http://localhost:${PORT}`);
    });
  } catch (err) {
    console.log(err.message);
  }
}

async function bdClose() {
  try {
    await client.close();
  } catch (err) {
    console.log(err.message);
  }
}
