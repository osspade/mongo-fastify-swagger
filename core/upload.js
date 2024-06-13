import { events, service, common } from './index.js'
import * as util from 'util';
import { pipeline } from 'stream';
import * as fs from 'fs';

const pump = util.promisify(pipeline)

export default class upload {

    constructor(util) {
        this.routes(util,this.constructor.name)
        new common(util,this.constructor.name)
    }

    routes(util,_collection) {

        const collection = util.db.collection(_collection)

        util.fastify.route({
            method: 'POST',
            url: `/${_collection}`,
            schema: {
                consumes: ['multipart/form-data'],
                tags: [_collection],
                description: _collection,
                body: {
                    type: 'object',
                    nullable: true,
                    required:["title","notes","files"],
                    properties: {
                        title: { type: 'string', default:"My new File"},
                        notes: { type: 'string' , default:"File descriptions"},
                        files: {
                            type: 'array',
                            items: { format: 'binary', type: 'string' }
                        },
                    },

                },
                   security: [{ apiauth: [] }],
            },
               preHandler: util.fastify.auth([util.fastify.authenticate]),
            handler: async function (request, reply) {
                const form_data = await request.file()
                const path = `./${_collection}/`
                let details = []
                if (form_data) {


                    if (Array.isArray(form_data.fields.files)) {
                        for await (const upload of form_data.fields.files) {
                            await pump(upload.file, fs.createWriteStream(path + upload.filename))
                            details.push({
                                "filename": upload.filename,
                                "path": path
                            })
                        }
                    } else {

                       // console.log("form_data.fields.files", form_data.fields)
                        await pump(form_data.fields.files.file, fs.createWriteStream(path + form_data.fields.files.filename))
                        details.push({
                            "filename": form_data.fields.files.filename,
                            "path": path
                        })
                    }

                    const schema = {

                        "title": form_data.fields.title.value,
                        "notes": form_data.fields.notes.value,
                        "files": details,
                        "account$account": {_id:request.auth._id},
                        "share": [],
                        "created": new Date()
                    }

                    await collection.insertOne(schema)
                    util.fastify.log.info(schema)

                    reply.status(200).send(schema);

                } else {
                    reply.status(400).send({ "message": "Missing Form Data" });

                }

            }


        })

    }

};

