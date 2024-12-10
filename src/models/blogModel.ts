import { t } from 'elysia';
import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const blogSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
    },
    slug: String,
    published: Boolean,
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    content: {
      type: String,
      required: true,
    },
    tags: {
      type: [String],
      trim: true,
      index: true,
    },
    comments: [
      {
        user: String,
        content: String,
        votes: Number,
      },
    ],
  },
  {
    timestamps: true,
  },
);

const Blog = model('Blog', blogSchema);
export default Blog;
