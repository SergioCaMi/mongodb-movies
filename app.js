//Express
const express = require("express");
const app = express();

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
bbddRun();

// ******************** Rutas ********************
app.get("/", async (req, res) => {
  const db = client.db("sample_mflix");
  const collection = db.collection("movies");
 const movies = await collection.find().limit(10).sort({year: -1}).toArray();  
 res.render("index.ejs", {
    movies: movies,
    title: "Movies",
  });
});

app.get("/pruebas", (req, res) => {
  console.log(res, req);
  res.render("index.ejs");
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
async function bbddRun() {
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

async function bbddClose() {
  try {
    await client.close();
  } catch (err) {
    console.log(err.message);
  }
}
