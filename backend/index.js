const express = require("express");
const cors = require("cors");
const path = require("path");
const { readFileContent } = require("./storage");
require("dotenv").config();

const app = express();

const allowedOrigins = process.env.FRONTEND_URL || "http://localhost:3000";

app.use(cors({
    origin: allowedOrigins === '*' ? '*' : allowedOrigins
}));
app.use(express.json());

let movies = [];
let similarity = [];

const loadDataFromGCS = async () => {
    try {
        movies = await readFileContent("movie.json");
        similarity = await readFileContent("similarity.json");
    } catch (error) {
        console.error("Error loading data from GCS:", error);
        throw new Error("Failed to load data");
    }
};

loadDataFromGCS()
    .then(() => {
        console.log("Data loaded successfully");
    })
    .catch((error) => {
        console.error("Failed to load data:", error);
        process.exit(1); // Exit if loading fails
    });

const getRecommendations = async (movieTitle) => {
    const movieIndex = movies.findIndex(
        (m) => m.title.toLowerCase() === movieTitle.toLowerCase()
    );
    if (movieIndex === -1) return [];

    let similarities;
    try {
        similarities = await readFileContent("similarity.json", movieIndex);
    } catch (error) {
        console.error(`Error fetching similarities for movie ${movieTitle}:`, error);
        return [];
    }

    if (!similarities) {
        console.error(`No similarities found for movie: ${movieTitle}`);
        return [];
    }

    return similarities
        .map((score, index) => ({
            movie: movies[index],
            score,
        }))
        .filter(
            (item) =>
                item.score > 0.1 &&
                item.movie.title.toLowerCase() !== movieTitle.toLowerCase()
        )
        .sort((a, b) => b.score - a.score)
        .slice(0, 14)
        .map((item) => item.movie);
};

app.get("/movies", (req, res) => {
    if (movies.length === 0) {
        return res.status(500).json({ error: "Movie data is not loaded" });
    }
    res.json(movies);
});

app.post("/recommend", async (req, res) => {
    const { movieTitle } = req.body;
    if (!movieTitle) {
        return res.status(400).json({ error: "Movie title is required" });
    }

    try {
        const recommendations = await getRecommendations(movieTitle);
        res.json({ recommendations });
    } catch (error) {
        res.status(500).json({ error: "Failed to get recommendations" });
    }
});

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on port ${port}`);
});
