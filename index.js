const express = require('express');
const req = require('express/lib/request');
const app = express();
const jwt = require('jsonwebtoken');
const cors = require('cors');
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY);
require('dotenv').config();
const port = process.env.PORT || 5000;
// middleware
app.use(cors());
app.use(express.json());
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if(!authorization){
    res.status(401).send({error: true, message: 'unauthorized access'});
  }
  const token = authorization.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if(err){
      return res.status(401).send({error: true, message: 'unauthorized access'})
    }
    req.decoded = decoded;
    next();
  })
}


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.o01z7ei.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const usersCollection = client.db("danceDb").collection("users");
    const dataCollection = client.db("danceDb").collection("data");
    const cartCollection = client.db("danceDb").collection("carts");
    const paymentCollection = client.db("danceDb").collection("payments");

app.post('/jwt', (req, res)=>{
  const user = req.body;
  const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
  res.send({token})
})

app.get('/users', async(req, res)=>{
  const result = await usersCollection.find().toArray();
  res.send(result);
})

app.post('/users', async(req, res)=>{
  const user = req.body;
  console.log(user);
  const query = {email: user.email};
  const existingUser = await usersCollection.findOne(query);
  console.log('existingUser', existingUser);
  if(existingUser){
    return res.send({message: 'user already exists'})
  }
  const result = await usersCollection.insertOne(user);
  res.send(result);
});

app.patch('/users/admin/:id', async(req, res)=>{
  const id = req.params.id;
  const query = {_id: new ObjectId(id)};
  const updateDoc = {
    $set: {
      role: 'admin'
    }
  };
  const result = await usersCollection.updateOne(query, updateDoc);
  res.send(result);
})


   app.get('/data', async(req, res) => {
const result = await dataCollection.find().toArray();
res.send(result);
   })

   app.get('/carts', verifyJWT, async(req, res) =>{
    const email = req.query.email;
    console.log(email);
    if(!email){
      res.send([]);
    }

    const decodedEmail = req.decoded.email;
    if(email !== decodedEmail){
      return res.status(403).send({error: true, message: 'porviden access'})
    }
    const query = { email: email};
    const result = await cartCollection.find(query).toArray();
    res.send(result);
   })
   app.post('/carts', async(req,res)=>{
    const item = req.body;
    console.log(item);
    const result = await cartCollection.insertOne(item);
    res.send(result);
   })

   app.delete('/carts/:id', async(req, res)=>{
    const id = req.params.id;
    const query = {_id: new ObjectId(id)};
    const result = await cartCollection.deleteOne(query);
    res.send(result);
   })

   app.post('create-payment-intent', verifyJWT, async(req, res)=>{
    const {price} = req.body;
    const amount = price*100;
    console.log(price, amount);
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
     currency: 'usd',
     payment_method_types: ['card']

    })
    res.send({
      clientSecret: paymentIntent.client_secret
    })
   })

   app.post('/payments', verifyJWT, async(req, res)=>{
    const payment = req.body;
    const insertResult = await paymentCollection.insertOne(payment);
    const query = {_id: { $in: payment.cartItems.map(id => new ObjectId(id) )}};
    const deleteResult = await cartCollection.deleteMany(query);
    res.send({insertResult, deleteResult});
   })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req,res)=>{
    res.send('dancing')
})

app.listen(port, ()=>{
    console.log(`dance till end${port}`);
})