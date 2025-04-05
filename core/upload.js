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
                description: 'Upload one or more files with title and notes metadata',
                body: {
                    type: 'object',
                    nullable: true,
                    required: ["title", "notes", "files"],
                    properties: {
                        title: { 
                            type: 'string', 
                            description: 'Title for the uploaded file(s)', 
                            default: "My new File"
                        },
                        notes: { 
                            type: 'string', 
                            description: 'Description or notes about the uploaded file(s)', 
                            default: "File descriptions"
                        },
                        files: {
                            type: 'array',
                            description: 'Files to upload (single file or multiple files)',
                            items: { 
                                format: 'binary', 
                                type: 'string',
                                description: 'Binary file content'
                            }
                        },
                    },
                },
                security: [{ apiauth: [] }],
                response: {
                    200: {
                        type: 'object',
                        description: 'Successful upload response',
                        properties: {
                            title: { 
                                type: 'string', 
                                description: 'Title provided for the upload' 
                            },
                            notes: { 
                                type: 'string', 
                                description: 'Notes provided for the upload' 
                            },
                            files: { 
                                type: 'array', 
                                description: 'Details of uploaded files',
                                items: {
                                    type: 'object',
                                    properties: {
                                        filename: { 
                                            type: 'string', 
                                            description: 'Name of the uploaded file' 
                                        },
                                        path: { 
                                            type: 'string', 
                                            description: 'Path where the file was stored' 
                                        }
                                    }
                                }
                            },
                            account$account: { 
                                type: 'object', 
                                description: 'Reference to the account that uploaded the files',
                                properties: {
                                    _id: { 
                                        type: 'string', 
                                        description: 'Unique identifier of the account' 
                                    }
                                }
                            },
                            share: { 
                                type: 'array', 
                                description: 'List of accounts this upload is shared with (empty by default)',
                                items: { type: 'string' }
                            },
                            created: { 
                                type: 'string', 
                                format: 'date-time',
                                description: 'Timestamp when the upload was created' 
                            }
                        }
                    },
                    400: {
                        type: 'object',
                        description: 'Missing form data error',
                        properties: {
                            message: { 
                                type: 'string', 
                                description: 'Error message (Missing Form Data)' 
                            }
                        }
                    },
                    401: {
                        type: 'object',
                        description: 'Authentication error',
                        properties: {
                            statusCode: { type: 'integer' },
                            error: { type: 'string' },
                            message: { type: 'string' }
                        }
                    },
                    413: {
                        type: 'object',
                        description: 'File too large error',
                        properties: {
                            statusCode: { type: 'integer' },
                            error: { type: 'string' },
                            message: { type: 'string', description: 'Request entity too large' }
                        }
                    },
                    500: {
                        type: 'object',
                        description: 'Server error during file processing',
                        properties: {
                            statusCode: { type: 'integer' },
                            error: { type: 'string' },
                            message: { type: 'string' }
                        }
                    }
                }
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

