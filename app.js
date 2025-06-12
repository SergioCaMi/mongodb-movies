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

// ********************************* Rutas *********************************
// ********************************* Home *********************************
app.get("/", async (req, res) => {
  const db = client.db("sample_mflix");
  const collection = db.collection("movies");
  const cursor = collection.find().sort({ released: -1 }).limit(10);
  const movies = [];
  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    movies.push(doc);
  }
  const allGenres = await getGenres();
  const allTypes = await getTypes();
  res.render("index.ejs", {
    movies: movies,
    title: "Movies",
    allGenres: allGenres,
    allTypes: allTypes,
    filters: {},
  });
});

// ********************************* Ruta para buscar películas *********************************
app.post("/movies", async (req, res) => {
  const db = client.db("sample_mflix");
  const collection = db.collection("movies");

  // Extraemos filtros del formulario
  const { keyword, genres, type, startYear, endYear, minRating, maxRating } = req.body;
  const page = parseInt(req.body.page) || 1; // Página actual (por defecto: 1)
  const PAGE_SIZE = 10;

  const allGenres = await getGenres();
  const allTypes = await getTypes();

  let query = {};
  let sorted = { released: Number(req.body.sort) };

  if (keyword) {
    query.title = { $regex: keyword, $options: "i" };
  }

  if (genres) {
    const genresArray = genres
      .split(",")
      .map((g) => g.trim())
      .filter((g) => g);
    if (genresArray.length > 0) {
      query.genres = { $all: genresArray };
    }
  }

  if (type) {
    const typesArray = type
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t);
    if (typesArray.length > 0) {
      query.type = { $in: typesArray };
    }
  }

  if (startYear && endYear) {
    query["$expr"] = {
      $and: [
        { $gte: [{ $year: "$released" }, parseInt(startYear)] },
        { $lte: [{ $year: "$released" }, parseInt(endYear)] }
      ]
    };
  }

  if (minRating && maxRating) {
    query["imdb.rating"] = {
      $gte: parseFloat(minRating),
      $lte: parseFloat(maxRating),
    };
  }

  // Contamos el total de resultados con filtro aplicado
  const total = await collection.countDocuments(query);

  // Calcular límites y offset
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const skip = (page - 1) * PAGE_SIZE;

  // Obtener resultados paginados
  const movies = await collection.find(query).sort(sorted).skip(skip).limit(PAGE_SIZE).toArray();

  // Renderizamos la vista pasando también currentPage y totalPages
  res.render("index.ejs", {
    movies,
    allGenres,
    allTypes,
    title: "Movies",
    filters: req.body,
    currentPage: page,
    totalPages
  });
});//*********************************  Ruta para mostrar el formulario de añadir *********************************
app.get("/movies/add-form", async (req, res) => {
  res.render("addForm.ejs");
});

//*********************************  Ruta para añadir *********************************
app.post("/movies/add-form", async (req, res) => {
  const db = client.db("sample_mflix");
  const collection = db.collection("movies");

  const newMovie = {
    title: req.body.title,
    poster: req.body.urlImage,
  };
  try {
    const resultado = await collection.insertOne(newMovie);
    if (resultado.acknowledged) {
      console.log("Película añadida correctamente");
    }
  } catch (e) {
    console.log("Error al añadir la nueva película", e.message);
  }
});

// ********************************* Ruta 404 para endpoints no definidos *********************************
app.use((req, res) => {
  res.status(404).send("Ruta no encontrada");
});

// ********************************* Manejo de errores global *********************************

app.use((err, req, res, next) => {
  console.error(err);
  res
    .status(500)
    .send(
      '<p>Ups! La operación ha fallado. Hemos informado a los desarrolladores. Vuelve a probarlo más tarde.Vuelve a la <a href="/">home page</a></p> '
    );
});

// ********************************* Funciones *********************************
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

async function getGenres() {
  const db = client.db("sample_mflix");
  const collection = db.collection("movies");
  return await collection
    .aggregate([
      { $unwind: "$genres" },
      { $group: { _id: "$genres" } },
      { $sort: { _id: 1 } },
    ])
    .toArray();
}

async function getTypes() {
  const db = client.db("sample_mflix");
  const collection = db.collection("movies");
  return await collection
    .aggregate([
      { $match: { type: { $ne: null } } },
      { $group: { _id: "$type" } },
      { $sort: { _id: 1 } },
    ])
    .toArray();
}

