import * as fs from 'node:fs';
import path from 'node:path';
const __dirname = import.meta.dirname;

export default class service {

    constructor() {
    }



    async populateResult(util, result) {

        for (const fieldData in result) {
            if (fieldData.indexOf('$') !== -1) {
                result[fieldData] = await this.populate(util, result[fieldData], fieldData.split("$")[1])
            }
        }
        return result;
    }


    async populate(util, result, _collection) {
        const projection = _collection == "account" ? { projection: { _id: 1, roles: 1, profile: 1 } } : {}
        
        if (Array.isArray(result)) {

            return await util.db.collection(_collection).find({
                '_id': {
                    $in:
                        result.map((item) => new util.fastify.mongo.ObjectId(item._id))
                }
            },projection).toArray()
        } else if (typeof result === 'object' || result instanceof Object) {
            return await util.db.collection(_collection).findOne({ _id: new util.fastify.mongo.ObjectId(result?._id) },projection)
        } else {
            return result
        }
    }

    async populateform(util, _collection) {
        const collection = util.db.collection(_collection)
        if (await collection.countDocuments({}) == 0) {

            const template_dir = path.join(__dirname, 'template')
            const language = this.get_directories(template_dir)

            language.forEach(lang => {
                const form_path = path.join(template_dir, lang + `/${_collection}`);

                this.get_files(form_path).forEach(async (file) => {
                    let file_path = path.join(form_path, file)

                    let data = await import(file_path, { assert: { type: "json" } })
                    let schema = {
                        "title": path.parse(file).name,
                        "language": lang,
                        //"path": file_path, // not needed
                        "data": data.default,
                        "response": [],
                    }
                    util.fastify.log.info(schema)
                    await collection.insertOne(schema);
                })

            });
        }

    }

    get_directories(pathto) {
        let dir = []
        if (fs.existsSync(pathto)) {
            return fs.readdirSync(pathto).filter(function (file) {
                if (fs.statSync(pathto + '/' + file).isDirectory()) {
                    dir.push(pathto + '/' + file)
                }
                return dir;

            });
        } else {
            return []
        }
    }

    get_files(pathto) {
        let files = []
        if (fs.existsSync(pathto)) {

            return fs.readdirSync(pathto).filter(function (file) {
                if (!fs.statSync(pathto + '/' + file).isDirectory()) {
                    files.push(file)
                }
                return files;
            });
        } else {
            return []
        }
    }

}

