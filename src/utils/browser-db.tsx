import { openDB } from 'idb';


// from chat-gpt
const DB_NAME = 'daqpy-webdashboard'
const STORE_NAME = 'current-dashboard'

export function openDatabase() {
    return openDB(DB_NAME, 1, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath : 'id'})
            }
        }
    })
}

export function storeCurrentDashboard(dashboard : Array<any>) {
    openDatabase().then((db) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        const store = tx.objectStore(STORE_NAME)
        for(let obj of dashboard){
            store.put(obj)
        }
    })
}

export const loadCurrentDashboard = async(server : string) => {
    const db = await openDatabase();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    return await store.get(server)
}