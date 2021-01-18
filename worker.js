const { Worker } = require('worker_threads');

function _useWorker (filepath) {
    return new Promise((resolve, reject) => {
        const worker = new Worker(filepath)
        worker.on('online', () => { console.log('Launching the chest game with worker') })
        worker.on('message', messageFromWorker => {
            console.log(messageFromWorker)
            return resolve
        })
        worker.on('error', reject)
        worker.on('exit', code => {
            if (code !== 0) {
                reject(new Error(`Worker stopped with exit code ${code}`))
            }
        })
    })
}

async function main () {
    await _useWorker('./serv.js')
}
main()