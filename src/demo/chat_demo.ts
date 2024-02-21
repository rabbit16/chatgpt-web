import express from 'express';
import { BingChat } from 'bing-chat';

const app = express();
app.use(express.json());

const port = 8800; // The port the Express app will listen on

app.post('/sendMessage', async (req, res) => {
  // Assuming you are sending the message to the API as part of the request body
  const message = req.body.message;
  
  try {
    const bingApi = new BingChat({
      cookie: process.env.BING_COOKIE, // Ensure your environment variable is set
    });

    // You might want to add error handling and checks here
    const apiResponse = await bingApi.sendMessage(message);
    res.json({ reply: apiResponse.text });
  } catch (error) {
    res.status(500).json({ error: 'An error occurred while sending the message.' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

export default app;
