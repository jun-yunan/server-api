import { Elysia, t } from 'elysia';
import Blog from '../models/blogModel';
import jwt from '@elysiajs/jwt';
import User from '../models/userModel';
import { convertBase64ToImage } from '../utils/convertBase64ToImage';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import cloudinary from 'cloudinary';
import fs from 'fs';

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

class BlogController {}

export const blog = new Elysia()
  .decorate('blogController', new BlogController())
  .use(
    jwt({
      name: 'jwt',
      secret: process.env.SECRET_JWT!,
    }),
  )
  .group('/api/blogs', (app) =>
    app
      .get(
        '/:blogId',
        async ({ error, jwt, cookie: { auth }, params }) => {
          try {
            if (!params.blogId) {
              return error(400, 'Missing blogId');
            }

            const token = await jwt.verify(auth.value);
            if (!token) {
              return error(401, 'Unauthorized');
            }

            const blog = await Blog.findById(params.blogId);
            if (!blog) {
              return error(404, 'Blog not found');
            }

            return {
              status: 'success',
              blog,
            };
          } catch (err) {
            console.log(err);

            return error(500, "Something's wrong");
          }
        },
        {
          params: t.Object({ blogId: t.String() }),
        },
      )
      .get('/', async ({ error, jwt, cookie: { auth } }) => {
        try {
          const identity = await jwt.verify(auth.value);
          if (!identity) {
            return error(401, 'Unauthorized');
          }

          const user = await User.findById(identity.id);
          if (!user) {
            return error(404, 'User not found');
          }

          const blogs = await Blog.find({ author: user._id })
            .sort({ createdAt: -1 })
            .exec();

          return blogs;
        } catch (err) {
          console.log(err);

          return error(500, "Something's wrong");
        }
      })
      .post(
        '/',
        async ({ body, jwt, error, cookie: { auth } }) => {
          try {
            const { title, tags, content, published } = body;
            if (!title || !content) {
              return error(400, 'Missing title, author or content');
            }

            const identity = await jwt.verify(auth.value);

            if (!identity) {
              return error(401, 'Unauthorized');
            }

            const user = await User.findById(identity.id);
            if (!user) {
              return error(404, 'User not found');
            }

            const contentParsed = JSON.parse(content);

            const base64Images: any[] = [];

            contentParsed.ops.forEach((op: any) => {
              if (
                op.insert &&
                op.insert.image &&
                op.insert.image.startsWith('data:image')
              ) {
                base64Images.push(op.insert.image);
              }
            });

            const outputFilePaths: string[] = [];

            if (base64Images.length !== 0) {
              base64Images.forEach((base64Image, index) => {
                const outputFilePath = `${process.cwd()}/temp/${
                  user._id
                }-${Date.now()}-${uuidv4()}.png`;
                convertBase64ToImage(base64Image, outputFilePath);
                outputFilePaths.push(outputFilePath);
              });
            }

            const cloudinaryPromises = outputFilePaths.map((outputFilePath) => {
              return cloudinary.v2.uploader.upload(outputFilePath, {
                folder: 'blogs',
                use_filename: true,
              });
            });

            const cloudinaryResults = await Promise.all(cloudinaryPromises);

            if (!cloudinaryResults) {
              return error(500, "Can't upload images to cloudinary");
            }

            outputFilePaths.forEach((outputFilePath) =>
              fs.unlinkSync(outputFilePath),
            );

            const imageUrls = cloudinaryResults.map(
              (result) => result.secure_url,
            );

            contentParsed.ops.forEach((op: any) => {
              if (
                op.insert &&
                op.insert.image &&
                op.insert.image.startsWith('data:image')
              ) {
                const index = base64Images.indexOf(op.insert.image);
                if (index !== -1) {
                  op.insert.image = imageUrls[index];
                }
              }
            });

            const blog = await Blog.create({
              author: user._id,
              title,
              content: JSON.stringify(contentParsed),
              tags,
              slug: title.toLowerCase().replace(/ /g, '-'),
              published,
            });

            if (!blog) {
              return error(500, "Can't create blog");
            }

            return {
              base64Images,
              outputFilePaths,
              imageUrls,
              contentParsed,
              blog,
            };

            // const blog = await Blog.create({
            //   author: user._id,
            //   title,
            //   content,
            //   tags,
            //   slug: title.toLowerCase().replace(/ /g, '-'),
            //   published,
            // });

            // if (!blog) {
            //   return error(500, "Can't create blog");
            // }

            // return {
            //   status: 'success',
            //   blog,
            // };
          } catch (err) {
            console.log(err);

            return error(500, "Something's wrong");
          }
        },
        {
          body: t.Object({
            title: t.String(),
            tags: t.Optional(t.Array(t.String())),
            content: t.String(),
            published: t.Boolean(),
          }),
        },
      )
      .delete(
        '/:blogId',
        async ({ error, jwt, params, cookie: { auth } }) => {
          try {
            if (!params.blogId) {
              return error(400, 'Missing blogId');
            }

            const identity = await jwt.verify(auth.value);

            if (!identity) {
              return error(401, 'Unauthorized');
            }

            const blog = await Blog.findByIdAndDelete(params.blogId);

            if (!blog) {
              return error(404, 'Blog not found');
            }

            return {
              status: 'success',
              blog,
            };
          } catch (err) {
            console.log(err);

            return error(500, "Something's wrong");
          }
        },
        {
          params: t.Object({ blogId: t.String() }),
        },
      )
      .put(
        '/:blogId',
        async ({ error, jwt, params, body, cookie: { auth } }) => {
          try {
            if (!params.blogId) {
              return error(400, 'Missing blogId');
            }
            if (!body) {
              return error(400, 'Missing body');
            }

            const identity = await jwt.verify(auth.value);

            if (!identity) {
              return error(401, 'Unauthorized');
            }

            const blog = await Blog.findByIdAndUpdate(
              params.blogId,
              {
                author: body.author,
                title: body.title,
                content: body.content,
                slug: body.title.toLowerCase().replace(/ /g, '-'),
              },
              {
                new: true,
              },
            );

            if (!blog) {
              return error(404, 'Update failed');
            }

            return {
              status: 'success',
              blog,
            };
          } catch (err) {
            console.log(err);

            return error(500, "Something's wrong");
          }
        },
        {
          params: t.Object({ blogId: t.String() }),
          body: t.Object({
            title: t.String(),
            author: t.String(),
            content: t.String(),
          }),
        },
      ),
  );
