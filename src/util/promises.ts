export async function raceWithCondition<T>(
  promises: Array<Promise<T>>,
  condition: (value: T) => boolean,
) {
  return new Promise<T>((resolve, reject) => {
    let resolved = false
    let resolvedValue: T | undefined

    for (const promise of promises) {
      promise.then((value) => {
        if (resolved) {
          return
        }

        if (condition(value)) {
          resolved = true
          resolvedValue = value
          resolve(value)
        }
      })
    }

    Promise.all(promises).then(() => {
      if (!resolvedValue) {
        reject(new Error('No promise resolved with the expected condition'))
      }
    })
  })
}
