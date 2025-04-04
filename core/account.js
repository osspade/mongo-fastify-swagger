import * as bcrypt from 'bcrypt'
import { events, service, common } from './index.js'

export default class account {


  constructor(util) {
    this.routes(util, this.constructor.name)
    new common(util, this.constructor.name)

  }

  routes(util, _collection) {

    const collection = util.db.collection(_collection);
    const template_dir = "./template"

    util.fastify.route({
      method: 'PUT',
      url: `/${_collection}/create`,
      schema: {
        tags: [_collection],
        description: 'Create Account',
        body: {
          type: 'object',
          required: ["password", "profile"],
          properties: {
            password: { type: 'string', default: "secret!" },
            roles: { type: 'array', items: { type: 'string', default: "admin" } },
            profile: {
              type: 'object',
              required: ["email", "firstname", "lastname", "phone", "language"],
              properties: {
                email: { type: 'string', default: "support+APITEST@xrstudios.com" },
                firstname: { type: 'string', default: "Bill" },
                lastname: { type: 'string', default: "Brown" },
                phone: { type: 'string', default: "+16475555555" },
                language: { type: 'string', default: "en" },
              }
            }
          }
        },
      },
      handler: async function (request, reply) {
        try {
          // Verify email is not already in the system
          const existingAccount = await collection.findOne({ "profile.email": request.body.profile.email });
          if (existingAccount) {
            return reply.status(409).send({ message: "Email already exists in the system" });
          }

          const auth = {
            'roles': request.body.roles,
            'password': bcrypt.hashSync(request.body.password, 10),
            'authkey': bcrypt.hashSync(request.body.profile.email + request.body.password, 10),
          }

          delete request.body.password
          delete request.body.roles
          const profile = {
            ...request.body,
            'created': new Date(),
          }

          let result = await collection.insertOne({
            ...profile,
            ...auth
          });

          let event = {
            'url': `/${_collection}/create`,
            'account$account': { _id: result.insertedId },
            'message': `${template_dir}/${profile.language}/${_collection}/create.message.cjs`,
            'subject': `${template_dir}/${profile.language}/${_collection}/create.subject.cjs`,
          }

          new events().email(util, event)
          reply.status(200).send(profile);
        } catch (error) {
          reply.status(500).send({ message: "Failed to create account", error: error.message });
        }
      }
    })

    util.fastify.route({
      method: 'POST',
      url: `/${_collection}/login`,
      schema: {
        tags: [_collection],
        description: 'Authenticate',
        body: {
          type: 'object',
          required: ["email", "password"],
          properties: {
            email: { type: 'string', default: "support+APITEST@xrstudios.com" },
            password: { type: 'string', default: "secret!" }
          }
        }, response: {
          200: {
            description: "Account Details",
            content: {
              'application/json': {
                schema: {
            type: 'object',
            properties: {
              "_id": { type: 'string' },
              "roles": { type: 'array', items:{type:'string'} },
              "authkey": { type: 'string' },
              "profile": {
                type: 'object', properties: {
                  "email": { type: 'string' },
                  "firstname": { type: 'string' },
                  "lastname": { type: 'string' },
                  "phone": { type: 'string' },
                  "language": { type: 'string' }
                }
              }
            }}}}
          }
        }
      },
      handler: async function (request, reply) {

        return collection.findOne({ "profile.email": request.body.email }).then(result => {
          if (result && result.password && bcrypt.compareSync(request.body.password, result.password)) {

            new events().log(util, {
              'url': `/${_collection}login/`,
              'account$account': { _id: new util.fastify.mongo.ObjectId(result._id) },
              'email': request.body.email,
            })

            reply.status(200).send({ "_id": result._id, "roles": result.roles, "authkey": result.authkey, "profile": result.profile });
          } else {

            let message = { 'message': "Authentication Failed" }

            new events().log(util, {
              'url': `/${_collection}login/`,
              'email': request.body.email,
              ...message
            })
            reply.status(400).send(message);
          }

        });

      }
    })

    util.fastify.route({
      method: 'GET',
      url: `/${_collection}`,
      schema: {
        tags: [_collection],
        description: `${_collection} Info`,
        security: [{ apiauth: [] }],
      },
      preHandler: util.fastify.auth([util.fastify.authenticate]),
      handler: async function (request, reply) {

        new events().log(util, {
          'url': `/${_collection}`,
          'account$account': { _id: new util.fastify.mongo.ObjectId(request.auth._id) },
        })

        reply.status(200).send(request.auth);
      }
    })

    util.fastify.route({
      method: 'GET',
      url: `/${_collection}/role/:role`,
      schema: {
        tags: [_collection],
        description: `${_collection} by Roles`,
        security: [{ apiauth: [] }],
      },
      preHandler: util.fastify.auth([util.fastify.authenticate]),
      handler: async function (request, reply) {
      const {role} = request.params

        new events().log(util, {
          'url': `/${_collection}/role/${role}`,
          'account$account': { _id: new util.fastify.mongo.ObjectId(request.auth._id) },
        })

        reply.status(200).send(await collection.find({roles:{ $all: [role]}},{ projection: { _id:1, profile: 1 } }).toArray());
      }
    })


    util.fastify.route({
      method: 'PUT',
      url: `/${_collection}/update`,
      schema: {
        tags: [_collection],
        description: `${_collection} Update`,
        body: {
          type: 'object',
          properties: {
            currentPassword: { type: 'string' },
            newPassword: { type: 'string' },
            profile: {
              type: 'object',
              properties: {
                email: { type: 'string' },
                firstname: { type: 'string' },
                lastname: { type: 'string' },
                phone: { type: 'string' },
                language: { type: 'string' },
              }
            }
          }
        },
        security: [{ apiauth: [] }],
      },
      preHandler: util.fastify.auth([util.fastify.authenticate]),
      handler: async function (request, reply) {
        try {
          const account_id = new util.fastify.mongo.ObjectId(request.auth._id);
          
          // Get current user data
          const currentUser = await collection.findOne({ "_id": account_id });
          if (!currentUser) {
            return reply.status(404).send({ message: "User not found" });
          }
          
          let updateSchema = {};
          const sensitiveUpdate = request.body.newPassword || request.body.profile?.email;
          
          // Require password verification for sensitive updates
          if (sensitiveUpdate) {
            if (!request.body.currentPassword) {
              return reply.status(400).send({ 
                message: "Current password is required when changing password or email" 
              });
            }
            
            // Verify the current password for sensitive updates
            if (!bcrypt.compareSync(request.body.currentPassword, currentUser.password)) {
              return reply.status(401).send({ message: "Current password is incorrect" });
            }
          }
          
          // Handle profile updates
          if (request.body.profile) {
            if (request.body.profile.firstname) {
              updateSchema['profile.firstname'] = request.body.profile.firstname;
            }
            if (request.body.profile.lastname) {
              updateSchema['profile.lastname'] = request.body.profile.lastname;
            }
            if (request.body.profile.phone) {
              updateSchema['profile.phone'] = request.body.profile.phone;
            }
            if (request.body.profile.language) {
              updateSchema['profile.language'] = request.body.profile.language;
            }
            if (request.body.profile.email) {
              updateSchema['profile.email'] = request.body.profile.email;
            }
          }
          
          // Handle password update if requested
          if (request.body.newPassword) {
            updateSchema['password'] = bcrypt.hashSync(request.body.newPassword, 10);
            
            // Update authkey if changing password
            const emailToUse = request.body.profile?.email || currentUser.profile.email;
            updateSchema.authkey = bcrypt.hashSync(emailToUse + request.body.newPassword, 10);
          }
          
          // Only proceed if there are fields to update
          if (Object.keys(updateSchema).length === 0) {
            return reply.status(400).send({ message: "No valid fields to update" });
          }
          
          await collection.updateOne(
            { "_id": account_id },
            { $set: updateSchema },
            { upsert: false }
          );
          
          let result = { "_id": account_id, "update": Object.keys(updateSchema) };
          
          let eventPayload = {
            'url': '/auth/update/',
            'message': `${template_dir}/${currentUser.profile.language}/${_collection}/update.message.cjs`,
            'subject': `${template_dir}/${currentUser.profile.language}/${_collection}/update.subject.cjs`,
            'account$account': { _id: account_id },
            ...result
          };
          
          new events().email(util, eventPayload);
          
          reply.status(200).send(result);
        } catch (error) {
          reply.status(500).send({ message: "Failed to update account", error: error.message });
        }
      }
    })

    util.fastify.route({
      method: 'POST',
      url: `/${_collection}/reset`,
      schema: {
        tags: [_collection],
        description: `${_collection} Reset Password`,
        body: {
          type: 'object',
          required: ["email"],

          properties: {
            email: { type: 'string' },
          }
        },
      },
      handler: async function (request, reply) {
        const schemaPayload = {
          'profile.email': request.body.email,
        }

        return collection.findOne(schemaPayload).then(async result => {
          if (result) {

            let eventPayload = {
              'url': `/${_collection}/reset`,
              'message': `${template_dir}/${result.profile.language}/${_collection}/reset.message.cjs`,
              'subject': `${template_dir}/${result.profile.language}/${_collection}/reset.subject.cjs`,
              ...result,
            }

            new events().email(util, eventPayload)

            reply.status(200).send({ "message": "Auth Reset" });

          } else {

            let message = {
              'url': '/auth/reset',
              ...schemaPayload,
              "message": "Auth Reset Failed."
            }
            new events().log(util, message)
            reply.status(400).send(message);
          }

        });

      }
    })

    // New endpoint to check what role an email is assigned to
    util.fastify.route({
      method: 'GET',
      url: `/${_collection}/check-email-role`,
      schema: {
        tags: [_collection],
        description: 'Check what role an email is assigned to',
        querystring: {
          type: 'object',
          required: ['email'],
          properties: {
            email: { type: 'string' }
          }
        },
        security: [{ apiauth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              email: { type: 'string' },
              roles: { type: 'array', items: { type: 'string' } },
              exists: { type: 'boolean' }
            }
          }
        }
      },
      preHandler: util.fastify.auth([util.fastify.authenticate]),
      handler: async function (request, reply) {
        try {
          const email = request.query.email;
          
          new events().log(util, {
            'url': `/${_collection}/check-email-role`,
            'account$account': { _id: new util.fastify.mongo.ObjectId(request.auth._id) },
            'email': email
          });
          
          const account = await collection.findOne({ "profile.email": email }, 
            { projection: { roles: 1, "profile.email": 1 } });
            
          if (account) {
            reply.status(200).send({
              email: email,
              roles: account.roles,
              exists: true
            });
          } else {
            reply.status(200).send({
              email: email,
              roles: [],
              exists: false
            });
          }
        } catch (error) {
          reply.status(500).send({ 
            message: "Failed to check email role", 
            error: error.message 
          });
        }
      }
    })

  }

};

