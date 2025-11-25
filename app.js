// Express
const express = require("express");
const app = express();

// Middleware para parsear application/json
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const path = require("path");

// Importar MongoClient de mongodb
const { MongoClient } = require("mongodb");
const { ObjectId } = require("mongodb");
const uri =
  "mongodb+srv://sergiocami84:Msg--300183@cluster0.mo4mc0w.mongodb.net/?retryWrites=true&w=majority";
const client = new MongoClient(uri);

// Morgan - logging
const morgan = require("morgan");
app.use(morgan("dev"));

// Puerto
const PORT = process.env.PORT || 3000;

// Estaticos y EJS
app.use(express.static(path.join(__dirname, "public")));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Conectar a la base de datos al iniciar el servidor
bdConect();

async function bdConect() {
  try {
    await client.connect();
    console.log("Conectado a la base de datos");

    const db = client.db("sample_mflix");
    const collection = db.collection("movies");

    // Crear índice en 'released' para evitar errores de memoria
    await collection.createIndex({ released: -1 });

    app.listen(PORT, () => {
      console.log(`Servidor escuchando en http://localhost:${PORT}`);
    });
  } catch (err) {
    console.log(err.message);
  }
}

// ********************************* Rutas *********************************
// ********************************* Home *********************************
app.get("/", async (req, res) => {
  const db = client.db("sample_mflix");
  const collection = db.collection("movies");

  // Películas recientes
  const cursor = collection.find().sort({ released: -1 }).limit(12);
  const movies = [];
  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    movies.push(doc);
  }

  const allGenres = await getGenres();
  const allTypes = await getTypes();
  const allDirectors = await getDirectors();

  res.render("index.ejs", {
    movies,
    allGenres,
    allTypes,
    allDirectors,
    title: "Movies",
    filters: {},
    currentPage: 1,
    totalPages: 1,
    totalResults: movies.length,
  });
});

// ********************************* Ruta para buscar películas *********************************
app.post("/movies", handleMoviesRequest);
app.get("/movies", handleMoviesRequest);

async function handleMoviesRequest(req, res) {
  const db = client.db("sample_mflix");
  const collection = db.collection("movies");

  const source = req.method === "POST" ? req.body : req.query;
  const {
    director,
    keyword,
    genres,
    type,
    startYear,
    endYear,
    minRating,
    maxRating,
    sort,
    page = 1,
  } = source;

  let query = {};
  let order = { released: -1 }; // Orden por defecto

  if (keyword) {
    query.title = { $regex: keyword, $options: "i" };
  }

  if (genres) {
    const genresArray = genres
      .split(",")
      .map((g) => g.trim())
      .filter(Boolean);
    if (genresArray.length > 0) {
      query.genres = { $all: genresArray };
    }
  }

  if (type) {
    const typesArray = type
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (typesArray.length > 0) {
      query.type = { $in: typesArray };
    }
  }

  if (startYear && endYear) {
    const startY = parseInt(startYear);
    const endY = parseInt(endYear);
    if (!isNaN(startY) && !isNaN(endY)) {
      query["$expr"] = {
        $and: [
          { $gte: [{ $year: "$released" }, startY] },
          { $lte: [{ $year: "$released" }, endY] },
        ],
      };
    }
  }

  if (minRating && maxRating) {
    const minR = parseFloat(minRating);
    const maxR = parseFloat(maxRating);
    if (!isNaN(minR) && !isNaN(maxR)) {
      query["imdb.rating"] = {
        $gte: minR,
        $lte: maxR,
      };
    }
  }

  if (director) {
    query.directors = { $in: [director] };
  }

  // Manejo del ordenamiento
  if (sort === "1" || sort === "-1") {
    order = { released: Number(sort) };
  } else {
    order = { released: -1 }; // Por defecto descending
  }

  const limit = 12;
  const pageNumber = Math.max(parseInt(page), 1);
  const skip = (pageNumber - 1) * limit;

  try {
    const totalResults = await collection.countDocuments(query);
    const totalPages = Math.ceil(totalResults / limit);

    const movies = await collection
      .find(query)
      .sort(order)
      .skip(skip)
      .limit(limit)
      .toArray();

    const allGenres = await getGenres();
    const allTypes = await getTypes();
    const allDirectors = await getDirectors();

    res.render("index.ejs", {
      movies,
      allGenres,
      allTypes,
      allDirectors,
      title: "Movies",
      filters: source,
      currentPage: pageNumber,
      totalPages,
      totalResults,
    });
  } catch (e) {
    console.error("Error al ejecutar la búsqueda:", e.message);
    res.status(500).send("Error al cargar las películas.");
  }
}

// *********************************  Ruta para mostrar el formulario de añadir *********************************
app.get("/movies/add-form", async (req, res) => {
  const allGenres = await getGenres();
  const allTypes = await getTypes();
  const allDirectors = await getDirectors();

  res.render("addForm.ejs", {
    allGenres,
    allTypes,
    allDirectors,
    title: "Agregar Película",
    filters: {}, // No hay filtros activos en este formulario
    msg: null,
    color: null,
  });
});

// *********************************  Ruta para añadir *********************************
app.post("/movies/add-form", async (req, res) => {
  const db = client.db("sample_mflix");
  const collection = db.collection("movies");

  const { title, year, type, genres, urlImage, synopsis, director } = req.body;

  const newMovie = {
    title,
    year: year ? parseInt(year) : undefined,
    type,
    genres: genres ? genres.split(",").map((g) => g.trim()) : [],
    directors: director ? [director] : [],
    poster: urlImage,
    plot: synopsis,
  };

  try {
    const resultado = await collection.insertOne(newMovie);
    if (resultado.acknowledged) {
      res.render("addForm.ejs", {
        allGenres: await getGenres(),
        allTypes: await getTypes(),
        allDirectors: await getDirectors(),
        title: "Agregar Película",
        filters: {},
        msg: `${newMovie.title} se ha añadido correctamente`,
        color: "green",
      });
    }
  } catch (e) {
    console.log("Error al añadir la nueva película", e.message);
    res.status(500).render("addForm.ejs", {
      allGenres: await getGenres(),
      allTypes: await getTypes(),
      allDirectors: await getDirectors(),
      title: "Agregar Película",
      filters: {},
      msg: "Hubo un error al agregar la película.",
      color: "red",
    });
  }
});

// ********************************* Ruta para mostrar el formulario de edición *********************************
app.get("/movies/edit/:id", async (req, res) => {
  const db = client.db("sample_mflix");
  const collection = db.collection("movies");

  const { id } = req.params;

  try {
    const movie = await collection.findOne({ _id: new ObjectId(id) });

    if (!movie) {
      return res.status(404).render("error", {
        title: "Película no encontrada",
        code: "404",
        message: "No se encontró la película.",
      });
    }

    const allGenres = await getGenres();
    const allTypes = await getTypes();
    const allDirectors = await getDirectors();

    res.render("editForm.ejs", {
      movie,
      allGenres,
      allTypes,
      allDirectors,
      title: "Editar Película",
      filters: {},
      msg: null,
      color: null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error al cargar la película.");
  }
});

// ********************************* Ruta para editar *********************************
app.post("/movies/edit/:id", async (req, res) => {
  const db = client.db("sample_mflix");
  const collection = db.collection("movies");

  const { id } = req.params;
  const { title, year, type, genres, urlImage, synopsis, director } = req.body;

  const updatedMovie = {
    title,
    year: year ? parseInt(year) : undefined,
    type,
    genres: genres ? genres.split(",").map((g) => g.trim()) : [],
    directors: director ? director.split(",").map((d) => d.trim()) : [],
    poster: urlImage,
    plot: synopsis,
  };

  try {
    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updatedMovie }
    );

    if (result.modifiedCount === 1 || result.matchedCount === 1) {
      res.redirect("/");
    } else {
      res.status(404).send("No se encontró la película con ese ID.");
    }
  } catch (err) {
    console.error("Error al editar la película:", err.message);
    res.status(500).send("Error al editar la película.");
  }
});

// ********************************* Eliminar *********************************
app.get("/delete", async (req, res) => {
  const db = client.db("sample_mflix");
  const collection = db.collection("movies");

  const { _id, filters } = req.query;

  if (!_id) {
    return res.status(400).render("error", {
      title: "ID requerido",
      code: "400",
      message: "Falta el ID de la película.",
    });
  }

  try {
    const result = await collection.deleteOne({
      _id: new ObjectId(_id),
    });

    if (result.deletedCount === 1) {
      if (filters) {
        const encodedFilters = encodeURIComponent(filters);
        res.redirect(`/movies?filters=${encodedFilters}`);
      } else {
        res.redirect("/");
      }
    } else {
      res.status(404).send("No se encontró la película con ese ID.");
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Error al eliminar la película.");
  }
});

// ********************************* Ruta 404 *********************************
app.use((req, res) => {
  res.status(404).render("error", {
    title: "No encontrado",
    code: "404",
    message: "La página que buscas no existe.",
  });
});

// ********************************* Manejo de errores global *********************************
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render("error", {
    title: "Error del servidor",
    code: "500",
    message: "Ups! La operación ha fallado. Hemos informado a los desarrolladores. Vuelve a probarlo más tarde."
  });
});

// ********************************* Funciones *********************************
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

async function getDirectors() {
  const db = client.db("sample_mflix");
  const collection = db.collection("movies");

  return await collection
    .aggregate([
      { $match: { directors: { $exists: true, $ne: [] } } },
      { $unwind: "$directors" },
      { $group: { _id: "$directors" } },
      { $sort: { _id: 1 } },
    ])
    .toArray();
}