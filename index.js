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
    const contestsCollection = database.collection("contests");

    // get all user
    app.get("/users", async (req, res) => {
      try {
        const result = await usersCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server Error" });
      }
    });

    //   user role get
    app.get("/users/:email/role", async (req, res) => {
      try {
        const email = req.params.email;
        //   console.log(email)
        const query = { email };
        const result = await usersCollection.findOne(query);
        //   console.log(result)
        res.send({ role: result?.role || "user" });
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server Error" });
      }
    });

    // get one user
    app.get("/users/one", async (req, res) => {
      try {
        const email = req.query.email;
        const query = {};

        if (email) {
          query.email = email;
        }

        const result = await usersCollection.findOne(query);
        res.send(result);
        // console.log(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server Error" });
      }
    });

    // update user info
    app.patch("/users/:id/info", async (req, res) => {
      try {
        const id = req.params.id;

        // const updatedInfo = req.body;
        // console.log(updatedInfo);

        const filter = { _id: new ObjectId(id) };
        const updatedDoc = { $set: req.body };
        const result = await usersCollection.updateOne(filter, updatedDoc);
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server Error" });
      }
    });

    // update user role
    app.patch("/users/:id", async (req, res) => {
      try {
        const id = req.params.id;

        console.log(id, req.body);

        const filter = { _id: new ObjectId(id) };
        const updatedDoc = { $set: req.body };
        const result = await usersCollection.updateOne(filter, updatedDoc);
        res.send(result);
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
        user.status = "Active";

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

    // contest related api's

    // get all by admin
    app.get("/contests", async (req, res) => {
      try {
        const result = await contestsCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server Error" });
      }
    });

    // get all contests by creator email
    app.get("/contests/creator", async (req, res) => {
      try {
        const email = req.query.email;
        const query = {};
        // console.log(email);
        if (!email) {
          return res.send({ message: "creator email not found" });
        } else {
          query.email = email;
        }

        const result = await contestsCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server Error" });
      }
    });

    // get one contest
    app.get("/contests/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await contestsCollection.findOne(query);
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server Error" });
      }
    });

    // created contest
    app.post("/contests", async (req, res) => {
      try {
        const contest = req.body;
        // console.log(contest);
        contest.status = "Pending";
        contest.createdAt = new Date();
        const result = await contestsCollection.insertOne(contest);
        res.status(201).send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server Error" });
      }
    });

    // update contest role for admin
    app.patch("/contests/:id/admin", async (req, res) => {
      try {
        const status = req.body.newStatus;
        // console.log(status)

        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = { $set: {status} };
        // console.log('check',filter,req.body)
        const result = await contestsCollection.updateOne(filter, updatedDoc);
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server Error" });
      }
    });

    // update contest for creator
    app.patch("/contests/:id/update", async (req, res) => {
      try {
        const id = req.params.id;

        // console.log(req.body);
        const contest = req.body;

        const contestInfo = {
          deadline: contest.deadline,
          description: contest.description,
          image: contest.image,
          instructions: contest.instructions,
          name: contest.name,
          price: contest.price,
          prizeMoney: contest.prizeMoney,
          type: contest.type,
        };
        // console.log(updatedDoc);

        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: contestInfo,
        };
        const result = await contestsCollection.updateOne(filter, updatedDoc);
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server Error" });
      }
    });

    // deleted contest
    app.delete("/contests/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await contestsCollection.deleteOne(query);
        res.send(result);
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
