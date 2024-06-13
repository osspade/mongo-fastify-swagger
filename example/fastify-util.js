// Import the framework and instantiate it
import { account, form, upload, wipay, product, order, events } from "mongo-fastify-swagger"
import Fastify from 'fastify'
import * as path from 'path';
import * as ejs from 'ejs'
import fastifyCron from 'fastify-cron'
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

export default class fastifyUtil {

  dbName = process.env.MONGO_DB || 'default'
  mongoUrl = process.env.MONGO_URL || 'mongodb://root:secret@localmongo:32768/';
  smtpCredentials = {
    defaults: {
      // set the default sender email address to jane.doe@example.tld
      from: process.env.SMTP_DEFAULTFROM || 'No Reply <noreply@example.com>',
      // set the default email subject to 'default example'
      subject: process.env.SMTP_DEFAULTSUBJECT || 'Default Example',
    },
    transport: {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    }
  }


  swaggerInfo = {
    title: process.env.SWAGGER_TITLE || `${this.dbName} Example API Platform`,
    description: process.env.SWAGGER_DESC || `Testing ${this.dbName} Example API Platform`,
    version: process.env.SWAGGER_VER || '0.1.0'
  }

  constructor() {
    const fastifyUtil = this.util(Fastify({
      logger: true
    }));

    fastifyUtil.then(util => {
      new account(util);
      new form(util)
      new upload(util)
      new wipay(util)
      new product(util)
      new order(util)
      new events()?.route(util)
    })

    return fastifyUtil
  }


  async util(fastify) {

    await fastify.register(import('@fastify/cors'), (instance) => {
      return (req, callback) => {
        const corsOptions = {
          // This is NOT recommended for production as it enables reflection exploits
          origin: true
        };

        // do not include CORS headers for requests from localhost
        if (/^localhost$/m.test(req.headers.origin)) {
          corsOptions.origin = false
        }

        // callback expects two parameters: error and options
        callback(null, corsOptions)
      }
    })


    await fastify.register(import('@fastify/swagger'), {
      openapi: {
        info: this.swaggerInfo,
        components: {
          securitySchemes: {
            apiauth: {
              type: 'http',
              scheme: 'bearer',
              in: 'header'
            }
          }
        },
      }
    })

    await fastify.register(import('@fastify/swagger-ui'), {
      routePrefix: '/',
      uiConfig: {
        docExpansion: 'full',
        deepLinking: false
      },
      uiHooks: {
        onRequest: function (request, reply, next) { next() },
        preHandler: function (request, reply, next) { next() }
      },
      staticCSP: true,
      transformStaticCSP: (header) => header,
      transformSpecification: (swaggerObject, request, reply) => { return swaggerObject },
      transformSpecificationClone: true,

    })

    await fastify.register(import("@fastify/view"), {
      engine: {
        "ejs": ejs,
      },
    });


    await fastify.register(import('@fastify/static'), {

      root: path.join(__dirname, 'upload/'),
      prefix: '/upload/', // optional: default '/'
      index: false,
      list: true
    })

    await fastify.register(import('@fastify/multipart'), {
      fieldNameSize: 100, // Max field name size in bytes
      fieldSize: 100,     // Max field value size in bytes
      fields: 10,         // Max number of non-file fields
      fileSize: 1000000,  // For multipart forms, the max file size in bytes
      files: 1,           // Max number of file fields
      headerPairs: 2000,  // Max number of header key=>value pairs
      parts: 1000         // For multipart forms, the max number of parts (fields + files)
    })


    await fastify.register(import('@fastify/mongodb'), {
      forceClose: true,
      url: this.mongoUrl
    })
    const db = await fastify.mongo.client.db(this.dbName)
    const orm = await mongoose.connect(this.mongoUrl, { dbName: this.dbName })


    await fastify.register(import('@fastify/auth')).decorate('authenticate', function (request, reply, done) {
      if (request.headers.authorization) {
        const collection = db.collection('account');
        collection.findOne({ "authkey": request.headers?.authorization.split(" ")[1] }, { projection: { _id: 1, roles: 1, profile: 1 } }).then(result => {
          if (result) {
            request.auth = result;
            done();

          } else {
            reply.status(200).send({
              message: "Authentication Failed"
            });
          }

        });

        // return done(Error('not anonymous'))
      } else {
        reply.status(400).send({
          message: "Authentication Failed, No Auth key"
        });
      }

    })

    await fastify.register(import('fastify-mailer'), this.smtpCredentials)

    await fastify.register(fastifyCron, {
      jobs: [
        {
          cronTime: '* * * * *',
          onTick: () => {
            if(process.env.SMTP_HOST) this.mailer({ fastify, db })
              // this.notification({fastify,db})
          },
          start: true // Start job immediately
        }
      ]
    })

    return { fastify, db, orm };
  }


  async mailer(util) {

    const collection = util.db.collection('events')
    const schema = { "email": true, "log.status": "pending", 'log.status': { '$ne': "complete" } }

    let pending = await collection.find(schema).toArray();

    pending.forEach(async data => {

      util.fastify.mailer.verify(async (error, success) => {
        if (error) {
          new events().log(util, { "mail": "failed", "error": error })
          collection.updateOne(
            { "_id": data._id },
            { $push: { log: { "status": "failed", "errors": error, "updated": new Date() } } })

        } else {
          let mail = {
            to: data.details.email,
            subject: await util.fastify.view(data.details.subject, data.details),
            html: await util.fastify.view(data.details.message, data.details)
          }
          util.fastify.mailer.sendMail(mail, (errors, info) => {

            if (errors) {

              new events().log(util, { "mail": "failed", "errors": errors })
              //update event log
              collection.updateOne(
                { "_id": data._id },
                { $push: { log: { "status": "failed", "errors": errors, "updated": new Date() } } })

            } else {

              //update event log
              collection.updateOne(
                { "_id": data._id },
                { $push: { log: { "status": "complete", ...info, "updated": new Date() } } })

            }

          })

        }
      });

    })

  }


  async notification(util) {

    const collection = util.db.collection('events')
    const schema = { "notification": true, "log.status": "pending", 'log.status': { '$ne': "complete" } }

    let pending = await collection.find(schema).toArray();

    pending.forEach(async data => {

      let notification = {
        to: data.details.email,
        subject: await util.fastify.view(data.details.subject, data.details),
        html: await util.fastify.view(data.details.message, data.details)
      }

    });


  }

};


