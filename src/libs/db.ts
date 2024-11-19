import mongoose from 'mongoose';

export default async function connect() {
  try {
    await mongoose.connect(
      `mongodb+srv://${process.env.DB_USERNAME!}:${process.env
        .DB_PASSWORD!}@cluster0.gbxyy.mongodb.net/${process.env
        .DB_NAME!}?retryWrites=true&w=majority&appName=Cluster0`,
    );
    console.log('Connected to MongoDB');
  } catch (error) {
    console.log(`Connect to MongoDB failed: ${error}`);
  }
}
