import { Elysia, t } from 'elysia';
import Blog from '../models/blogModel';
import jwt from '@elysiajs/jwt';
import User from '../models/userModel';
import { convertBase64ToImage } from '../utils/convertBase64ToImage';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import cloudinary from 'cloudinary';
import fs from 'fs';
import Comment from '../models/commentModel';
import mongoose from 'mongoose';

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

class LikeController {}

export const like = new Elysia()
  .decorate('likeController', new LikeController())
  .use(
    jwt({
      name: 'jwt',
      secret: process.env.SECRET_JWT!,
    }),
  )
  .group('/api/likes', (app) =>
    app.post(
      '/',
      async ({ error, jwt, cookie: { auth }, request, params }) => {},
    ),
  );
