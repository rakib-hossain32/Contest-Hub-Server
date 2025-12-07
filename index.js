const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const app = express();
const cors = require("cors");
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

// const uri =
//   "mongodb+srv://contest-hub:DjFjdKYgJV5PcNR4@cluster0.zneri.mongodb.net/?appName=Cluster0";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(process.env.DB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const database = client.db("Contest_Hub");
    const usersCollection = database.collection("users");

    //   user role get
    app.get("/users/:email/role", async (req, res) => {
      try {
          const  email  = req.params.email;
        //   console.log(email)
        const query = { email };
          const result = await usersCollection.findOne(query)
        //   console.log(result)
        res.send({ role: result?.role || "user" });
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server Error" });
      }
    });

    //   user created
    app.post("/users", async (req, res) => {
      try {
        const user = req.body;
        user.role = "user";
        user.createdAt = new Date();

        const email = user.email;

        const existUser = await usersCollection.findOne({ email });
        if (existUser) {
          return res.send("User Already Exist");
        }

        const result = await usersCollection.insertOne(req.body);
        res.status(201).send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server Error" });
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Contest Hub Server is Running");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
