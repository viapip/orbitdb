import { fakerRU as faker } from "@faker-js/faker";
import { startOrbitDB, stopOrbitDB, } from "./orbit";
import { logger } from "./logger";
import { IPFSAccessController, OrbitDBAccessController } from '@orbitdb/core'
// import {userA, userB, identities} from './create-users'

// const users = [userA, userB]
// Get DB name and directory from command line
const dbName = process.argv[2] || "my-database";
const dbDir = process.argv[3] || "./orbitdb";

const dbId = process.argv[4] || "zdpuAsxVFKAoY6z8LnLsUtTKkGB4deEcXmhyAEbwkefaLsXR6";
const userId = process.argv[5] || "0";
logger.log('args', process.argv)
// Create OrbitDB instance
// const currentUser = users[Number(userId)]
const orbitdb = await startOrbitDB({
    id: dbId,
    directory: dbDir,
})

const accessController = await OrbitDBAccessController({ write: ['*'] })
orbitdb.ipfs.libp2p.logger = logger
// logger.log('orbitDb',orbitdb.ipfs.libp2p.logger)
// Open a database
const db = await orbitdb.open<'documents', { _id: string; test: string }, 'orbitdb'>(dbName, { type: "documents", AccessController: accessController });
logger.log("address", db.address);

// Listen for updates
db.events.on(
    "update",
    ({ id, hash, payload: { key, op } }) =>
        logger.log("onupdate", { id, hash, op, key }),
);
db.events.on('join', (peerId, heads) => {
    // db.access?.grant('write', peerId.)
    logger.log('join', peerId)
});
db.events.on("drop", () => logger.log("drop"));

while (true) {
    const opt = await logger.prompt('Enter a command: ', {
        type: 'select',
        options: [
            { label: 'Get', value: 'get' },
            { label: 'Put', value: 'put' },
            { label: 'Exit', value: 'exit' },
            { label: 'Sync stop', value: 'sync.stop' },
            { label: 'Sync start', value: 'sync.start' },
            { label: 'All', value: 'all' }
        ],
    }) as unknown as string;
    logger.log("opt", opt);
    switch (opt) {
        case 'get':
            const k = await logger.prompt('Enter key: ', { type: 'text' })
            const v = await db.get(k);
            logger.debug("value", v);
            break;
        case 'put':
            const _id = await logger.prompt('Enter key: ', { type: 'text' })
            const value = await logger.prompt('Enter value: ', { type: 'text' })
            await db.put({ _id, test: value });
            break;
        case 'all':
            const all = await db.all();
            logger.debug("all", all);
            break;
        case 'sync.stop':
            await db.sync.stop();
            break;
        case 'sync.start':
            await db.sync.start();
            break;

        case 'exit':
            process.exit(0);

    }
}
// Add some data
// await generate(1000000);

// Get some data
const value = await db.get("12");

logger.debug("value", value);

// Iterate over records
for await (const record of db.iterator({ amount: 1 })) {
    logger.warn("record", record);
}

// Stop OrbitDB
// await stopOrbitDB(orbitdb);

async function generate(size: number, chunkSize: number = 1000) {
    let time = 0;
    for (let i = 0; i < size; i += chunkSize) {
        const length = Math.min(chunkSize, size - i);
        const chunk = Array.from({ length }, (_, j) => ({
            _id: (i + (j + 1)).toString(),
            firstName: faker.person.firstName(),
            lastName: faker.person.lastName(),
            email: faker.internet.email(),
            company: faker.company.name(),
            phone: faker.phone.number(),
            value: faker.lorem.paragraphs({ min: 2, max: 5 }),
        }));

        const startTime = performance.now();
        await Promise.all(chunk.map(db.put));
        time += performance.now() - startTime;
    }

    logger.info("time", `took ${(1000 / time / size).toFixed(2)}op/sec average`);
}

