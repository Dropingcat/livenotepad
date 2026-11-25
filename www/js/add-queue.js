/**
 * Серийная очередь асинхронных задач.
 * Каждый enqueue добавляет задачу в цепочку; следующая стартует только
 * после завершения предыдущей. Отклонённая задача не рвёт цепочку.
 */
export function createSerialQueue() {
  let chain = Promise.resolve();
  return {
    enqueue(task) {
      chain = chain.then(() => task()).catch(() => {});
      return chain;
    }
  };
}