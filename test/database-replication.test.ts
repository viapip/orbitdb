import { strictEqual, deepStrictEqual } from 'assert'
import { rimraf } from 'rimraf'
import { copy } from 'fs-extra'

import {
	Database,
	Keystore,
	Identities,
	ComposedStorage,
	IPFSBlockStorage,
	MemoryStorage, DatabaseInstance, IdentityInstance, IdentitiesInstance, KeyStoreInstance, IPFS, LogEntry
} from '@orbitdb/core'

import testKeysPath from './fixtures/test-keys-path'
import connectPeers from './utils/connect-nodes'
import waitFor from './utils/wait-for'
import createHelia from './utils/create-helia'

import {
	after,
	afterEach,
	before,
	beforeEach,
	describe,
	it
} from "node:test";
const keysPath = './testkeys'

describe('Database - Replication', function () {
  let ipfs1: IPFS, ipfs2: IPFS
  let keystore: KeyStoreInstance
  let identities: IdentitiesInstance
  let testIdentity1: IdentityInstance, testIdentity2: IdentityInstance
  let db1: DatabaseInstance<any>, db2: DatabaseInstance<any>

  const databaseId = 'documents-AAA'

  const accessController = {
    canAppend: async (entry: LogEntry) => {
      const identity1 = await identities.getIdentity(entry.identity)
      const identity2 = await identities.getIdentity(entry.identity)
      return identity1.id === testIdentity1.id || identity2.id === testIdentity2.id
    }
  }

  beforeEach(async () => {
    [ipfs1, ipfs2] = await Promise.all([createHelia(), createHelia()])
    await connectPeers(ipfs1, ipfs2)

    await copy(testKeysPath, keysPath)
    keystore = await Keystore({ path: keysPath })
    identities = await Identities({ keystore })
    testIdentity1 = await identities.createIdentity({ id: 'userA' })
    testIdentity2 = await identities.createIdentity({ id: 'userB' })
  })

  afterEach(async () => {
    if (db1) {
      await db1.drop()
      await db1.close()

      await rimraf('./orbitdb1')
    }
    if (db2) {
      await db2.drop()
      await db2.close()

      await rimraf('./orbitdb2')
    }

    if (ipfs1) {
      await ipfs1.stop()
    }

    if (ipfs2) {
      await ipfs2.stop()
    }

    if (keystore) {
      await keystore.close()
    }

    await rimraf(keysPath)
    await rimraf('./ipfs1')
    await rimraf('./ipfs2')
  })

  describe('Replicate across peers', () => {
    beforeEach(async () => {
      db1 = await Database({ ipfs: ipfs1, identity: testIdentity1, address: databaseId, accessController, directory: './orbitdb1' })
    })

    it('replicates databases across two peers', async () => {
      let replicated = false
      let expectedEntryHash: null | string = null

      const onConnected = (peerId, heads) => {
        replicated = expectedEntryHash !== null && heads.map(e => e.hash).includes(expectedEntryHash)
      }

      const onUpdate = (entry: LogEntry) => {
        replicated = expectedEntryHash !== null && entry.hash === expectedEntryHash
      }

      db2 = await Database({ ipfs: ipfs2, identity: testIdentity2, address: databaseId, accessController, directory: './orbitdb2' })

      db2.events.on('join', onConnected)
      db2.events.on('update', onUpdate)

      await db1.addOperation({ op: 'PUT', key: 1, value: 'record 1 on db 1' })
      await db1.addOperation({ op: 'PUT', key: 2, value: 'record 2 on db 1' })
      await db1.addOperation({ op: 'PUT', key: 3, value: 'record 3 on db 1' })
      expectedEntryHash = await db1.addOperation({ op: 'PUT', key: 4, value: 'record 4 on db 1' })

      await waitFor(() => replicated, () => true)

      const all1: LogEntry[] = []
      for await (const item of db1.log.iterator()) {
        all1.unshift(item)
      }

      const all2: LogEntry[] = []
      for await (const item of db2.log.iterator()) {
        all2.unshift(item)
      }

      deepStrictEqual(all1, all2)
    })

    it('replicates databases across two peers with delays', async () => {
      let replicated: boolean|string| null = false
      let expectedEntryHash: null|string = null

      const onConnected = (peerId: string, heads: LogEntry[]) => {
        replicated = expectedEntryHash && heads.map(e => e.hash).includes(expectedEntryHash)
      }

      const onUpdate = (entry: LogEntry) => {
        replicated = expectedEntryHash && entry.hash === expectedEntryHash
      }

      db2 = await Database({ ipfs: ipfs2, identity: testIdentity2, address: databaseId, accessController, directory: './orbitdb2' })

      db2.events.on('join', onConnected)
      db2.events.on('update', onUpdate)

      await db1.addOperation({ op: 'PUT', key: 1, value: 'record 1 on db 1' })

      await new Promise<void>(resolve => {
        setTimeout(() => resolve(), 1000)
      })

      await db1.addOperation({ op: 'PUT', key: 2, value: 'record 2 on db 1' })
      await db1.addOperation({ op: 'PUT', key: 3, value: 'record 3 on db 1' })

      await new Promise<void>(resolve => {
        setTimeout(() => resolve(), 1000)
      })

      expectedEntryHash = await db1.addOperation({ op: 'PUT', key: 4, value: 'record 4 on db 1' })

      await waitFor(() => replicated, () => true)

      const all1: LogEntry[] = []
      for await (const item of db1.log.iterator()) {
        all1.unshift(item)
      }

      const all2: LogEntry[] = []
      for await (const item of db2.log.iterator()) {
        all2.unshift(item)
      }

      deepStrictEqual(all1, all2)
    })

    it('adds an operation before db2 is instantiated', async () => {
      let connected = false

      const onConnected = (peerId: string, heads: LogEntry[]) => {
        connected = true
      }

      await db1.addOperation({ op: 'PUT', key: 1, value: 'record 1 on db 1' })

      db2 = await Database({ ipfs: ipfs2, identity: testIdentity2, address: databaseId, accessController, directory: './orbitdb2' })

      db2.events.on('join', onConnected)

      await waitFor(() => connected, () => true)

      const all1: LogEntry[] = []
      for await (const item of db1.log.iterator()) {
        all1.unshift(item)
      }

      const all2: LogEntry[] = []
      for await (const item of db2.log.iterator()) {
        all2.unshift(item)
      }

      deepStrictEqual(all1, all2)
    })
  })

  describe('Options', () => {
    it('uses given ComposedStorage with MemoryStorage/IPFSBlockStorage for entryStorage', async () => {
      const storage1 = await ComposedStorage(await MemoryStorage(), await IPFSBlockStorage({ ipfs: ipfs1, pin: true }))
      const storage2 = await ComposedStorage(await MemoryStorage(), await IPFSBlockStorage({ ipfs: ipfs2, pin: true }))
      db1 = await Database({ ipfs: ipfs1, identity: testIdentity1, address: databaseId, accessController, directory: './orbitdb1', entryStorage: storage1 })
      db2 = await Database({ ipfs: ipfs2, identity: testIdentity2, address: databaseId, accessController, directory: './orbitdb2', entryStorage: storage2 })

      let connected1 = false
      let connected2 = false

      const onConnected1 = (peerId: string, heads: LogEntry[]) => {
        connected1 = true
      }

      const onConnected2 = (peerId: string, heads: LogEntry[]) => {
        connected2 = true
      }

      db1.events.on('join', onConnected1)
      db2.events.on('join', onConnected2)

      await db1.addOperation({ op: 'PUT', key: 1, value: 'record 1 on db 1' })
      await db1.addOperation({ op: 'PUT', key: 2, value: 'record 2 on db 1' })
      await db1.addOperation({ op: 'PUT', key: 3, value: 'record 3 on db 1' })
      await db1.addOperation({ op: 'PUT', key: 4, value: 'record 4 on db 1' })

      await waitFor(() => connected1, () => true)
      await waitFor(() => connected2, () => true)

      const all1: LogEntry[] = []
      for await (const item of db1.log.iterator()) {
        all1.unshift(item)
      }

      const all2: LogEntry[] = []
      for await (const item of db2.log.iterator()) {
        all2.unshift(item)
      }

      deepStrictEqual(all1, all2)
    })
  })

  describe('Events', () => {
    beforeEach(async () => {
      db1 = await Database({ ipfs: ipfs1, identity: testIdentity1, address: databaseId, accessController, directory: './orbitdb1' })
      db2 = await Database({ ipfs: ipfs2, identity: testIdentity2, address: databaseId, accessController, directory: './orbitdb2' })
    })

    it('emits \'update\' once when one operation is added', async () => {
      const expected = 1
      let connected1 = false
      let connected2 = false
      let updateCount1 = 0
      let updateCount2 = 0

      const onConnected1 = (peerId: string, heads: LogEntry[]) => {
        connected1 = true
      }

      const onConnected2 = (peerId: string, heads: LogEntry[]) => {
        connected2 = true
      }

      const onUpdate1 = async (entry) => {
        ++updateCount1
      }

      const onUpdate2 = async (entry) => {
        ++updateCount2
      }

      db1.events.on('join', onConnected1)
      db2.events.on('join', onConnected2)
      db1.events.on('update', onUpdate1)
      db2.events.on('update', onUpdate2)

      await waitFor(() => connected1, () => true)
      await waitFor(() => connected2, () => true)

      await db1.addOperation({ op: 'PUT', key: 1, value: 'record 1 on db 1' })

      await waitFor(() => updateCount1 >= expected, () => true)
      await waitFor(() => updateCount2 >= expected, () => true)

      strictEqual(updateCount1, expected)
      strictEqual(updateCount2, expected)
    })

    it('emits \'update\' 4 times when 4 documents are added', async () => {
      const expected = 4
      let connected1 = false
      let connected2 = false
      let updateCount1 = 0
      let updateCount2 = 0

      const onConnected1 = async (peerId: string, heads: LogEntry[]) => {
        connected1 = true
      }

      const onConnected2 = async (peerId: string, heads: LogEntry[]) => {
        connected2 = true
      }

      const onUpdate1 = async (entry: LogEntry) => {
        ++updateCount1
      }

      const onUpdate2 = async (entry: LogEntry) => {
        ++updateCount2
      }

      db1.events.on('join', onConnected1)
      db2.events.on('join', onConnected2)
      db1.events.on('update', onUpdate1)
      db2.events.on('update', onUpdate2)

      await waitFor(() => connected1, () => true)
      await waitFor(() => connected2, () => true)

      await db1.addOperation({ op: 'PUT', key: 1, value: '11' })
      await db1.addOperation({ op: 'PUT', key: 2, value: '22' })
      await db1.addOperation({ op: 'PUT', key: 3, value: '33' })
      await db1.addOperation({ op: 'PUT', key: 4, value: '44' })

      await waitFor(() => updateCount1 >= expected, () => true)
      await waitFor(() => updateCount2 >= expected, () => true)

      strictEqual(updateCount1, expected)
      strictEqual(updateCount2, expected)
    })
  })
})
