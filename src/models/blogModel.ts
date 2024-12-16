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
    imageUrl: String,
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
        type: Schema.Types.ObjectId,
        ref: 'Comment',
      },
    ],
    likes: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Like',
      },
    ],
    shares: [],
  },
  {
    timestamps: true,
  },
);
blogSchema.index({ tags: 1 });
const Blog = model('Blog', blogSchema);
export default Blog;
