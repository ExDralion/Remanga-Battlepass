(() => {
  const smb = window.SMBP;
  if (!smb || smb.BatchExecutor) return;

  class BatchExecutor {
    constructor(batchSize = 5, delayBetweenBatches = 1500) {
      this.batchSize = Math.max(1, Number(batchSize) || 5);
      this.delayBetweenBatches = Math.max(0, Number(delayBetweenBatches) || 0);
      this.isRunning = false;
      this.paused = false;
      this.stopRequested = false;
      this.currentBatch = 0;
      this.totalBatches = 0;
      this.results = [];
    }

    async executeBatch(items, taskRunner, hooks = null) {
      const options = typeof hooks === 'function' ? { onProgress: hooks } : (hooks || {});
      this.isRunning = true;
      this.paused = false;
      this.stopRequested = false;
      this.currentBatch = 0;
      this.results = [];
      this.totalBatches = Math.ceil(items.length / this.batchSize);

      for (let index = 0; index < items.length; index += this.batchSize) {
        if (this.stopRequested) break;

        while (this.paused && !this.stopRequested) {
          await smb.sleep(100);
        }

        if (this.stopRequested) break;

        this.currentBatch = Math.floor(index / this.batchSize) + 1;
        const batchItems = items.slice(index, index + this.batchSize);

        options.onProgress?.({
          currentBatch: this.currentBatch,
          totalBatches: this.totalBatches,
          processedItems: index,
          totalItems: items.length
        });

        const settled = await Promise.allSettled(batchItems.map(item => taskRunner(item)));
        this.results.push(...settled);
        const hookResult = await options.onBatchComplete?.({
          currentBatch: this.currentBatch,
          totalBatches: this.totalBatches,
          batchItems,
          results: settled,
          processedItems: Math.min(index + batchItems.length, items.length),
          totalItems: items.length
        });

        if (hookResult?.stop) {
          this.stopRequested = true;
        }

        if (!this.stopRequested && index + this.batchSize < items.length && this.delayBetweenBatches > 0) {
          await smb.sleep(this.delayBetweenBatches);
        }
      }

      this.isRunning = false;
      return this.getResults();
    }

    pause() {
      this.paused = true;
    }

    resume() {
      this.paused = false;
    }

    stop() {
      this.stopRequested = true;
      this.isRunning = false;
    }

    getResults() {
      const successful = this.results.filter(entry => entry.status === 'fulfilled').length;
      const failed = this.results.filter(entry => entry.status === 'rejected').length;
      return {
        successful,
        failed,
        total: this.results.length,
        details: this.results
      };
    }
  }

  smb.BatchExecutor = BatchExecutor;
  smb.batchExecutor = new BatchExecutor();
})();
