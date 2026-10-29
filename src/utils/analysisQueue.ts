/**
 * Intelligent analysis queue manager
 * Optimizes AI suggestion workflow by batching, debouncing, and cancelling outdated requests
 */

export interface AnalysisRequest {
  id: string;
  text: string;
  selectedText?: string;
  mode: 'realtime' | 'selection';
  timestamp: number;
  priority: 'high' | 'normal' | 'low';
}

export interface AnalysisQueueOptions {
  /**
   * Maximum time to wait before processing (ms)
   */
  maxWaitTime: number;
  
  /**
   * Minimum time between analyses (ms)
   */
  minInterval: number;
  
  /**
   * Maximum number of concurrent analyses
   */
  maxConcurrent: number;
  
  /**
   * Enable intelligent batching
   */
  enableBatching: boolean;
}

export class AnalysisQueue {
  private queue: AnalysisRequest[] = [];
  private activeRequests: Map<string, AbortController> = new Map();
  private lastAnalysisTime: number = 0;
  private processingTimer: ReturnType<typeof setTimeout> | null = null;
  private options: AnalysisQueueOptions;
  
  constructor(options?: Partial<AnalysisQueueOptions>) {
    this.options = {
      maxWaitTime: 2000,
      minInterval: 500,
      maxConcurrent: 2,
      enableBatching: true,
      ...options,
    };
  }

  /**
   * Add analysis request to queue
   */
  enqueue(request: Omit<AnalysisRequest, 'id' | 'timestamp'>): string {
    const id = `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const fullRequest: AnalysisRequest = {
      ...request,
      id,
      timestamp: Date.now(),
    };

    // Cancel any pending requests for the same mode (they're now outdated)
    this.cancelByMode(request.mode);

    // Add to queue
    this.queue.push(fullRequest);

    // Sort by priority and timestamp
    this.queue.sort((a, b) => {
      const priorityOrder = { high: 0, normal: 1, low: 2 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.timestamp - b.timestamp;
    });

    // Schedule processing
    this.scheduleProcessing();

    return id;
  }

  /**
   * Cancel a specific request
   */
  cancel(requestId: string): void {
    // Remove from queue
    this.queue = this.queue.filter(req => req.id !== requestId);

    // Cancel active request
    const controller = this.activeRequests.get(requestId);
    if (controller) {
      controller.abort();
      this.activeRequests.delete(requestId);
    }
  }

  /**
   * Cancel all requests of a specific mode
   */
  private cancelByMode(mode: 'realtime' | 'selection'): void {
    // Remove from queue
    const toCancel = this.queue.filter(req => req.mode === mode);
    this.queue = this.queue.filter(req => req.mode !== mode);

    // Cancel active requests
    toCancel.forEach(req => {
      const controller = this.activeRequests.get(req.id);
      if (controller) {
        controller.abort();
        this.activeRequests.delete(req.id);
      }
    });
  }

  /**
   * Cancel all pending and active requests
   */
  cancelAll(): void {
    this.queue = [];
    this.activeRequests.forEach(controller => controller.abort());
    this.activeRequests.clear();
    
    if (this.processingTimer) {
      clearTimeout(this.processingTimer);
      this.processingTimer = null;
    }
  }

  /**
   * Schedule request processing with intelligent timing
   */
  private scheduleProcessing(): void {
    if (this.processingTimer) {
      clearTimeout(this.processingTimer);
    }

    const now = Date.now();
    const timeSinceLastAnalysis = now - this.lastAnalysisTime;
    
    // Determine wait time based on priority and timing
    let waitTime = this.options.maxWaitTime;
    
    if (this.queue.length > 0) {
      const highPriorityRequest = this.queue.find(req => req.priority === 'high');
      
      if (highPriorityRequest) {
        // High priority: process quickly, but respect minimum interval
        waitTime = Math.max(300, this.options.minInterval - timeSinceLastAnalysis);
      } else if (timeSinceLastAnalysis < this.options.minInterval) {
        // Normal priority: wait for minimum interval
        waitTime = this.options.minInterval - timeSinceLastAnalysis;
      } else {
        // Ready to process immediately
        waitTime = 100;
      }
    }

    this.processingTimer = setTimeout(() => {
      this.processQueue();
    }, waitTime);
  }

  /**
   * Process queued requests
   */
  private async processQueue(): Promise<void> {
    if (this.queue.length === 0) {
      return;
    }

    // Check concurrent limit
    if (this.activeRequests.size >= this.options.maxConcurrent) {
      // Wait and try again
      this.processingTimer = setTimeout(() => this.processQueue(), 500);
      return;
    }

    // Get next request
    const request = this.queue.shift();
    if (!request) return;

    // Check if request is too old (stale)
    const age = Date.now() - request.timestamp;
    if (age > 10000) {
      // Request is over 10 seconds old, skip it
      console.log(`Skipping stale analysis request (age: ${age}ms)`);
      this.scheduleProcessing();
      return;
    }

    // Update last analysis time
    this.lastAnalysisTime = Date.now();

    // Process the request
    // (The actual analysis will be triggered by the callback passed during execution)
    
    // Continue processing queue if there are more items
    if (this.queue.length > 0) {
      this.scheduleProcessing();
    }
  }

  /**
   * Execute analysis with abort support
   */
  async execute<T>(
    requestId: string,
    analysisFunction: (signal: AbortSignal) => Promise<T>
  ): Promise<T | null> {
    const controller = new AbortController();
    this.activeRequests.set(requestId, controller);

    try {
      const result = await analysisFunction(controller.signal);
      return result;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log(`Analysis ${requestId} was cancelled`);
        return null;
      }
      throw error;
    } finally {
      this.activeRequests.delete(requestId);
    }
  }

  /**
   * Get queue statistics
   */
  getStats() {
    return {
      queueLength: this.queue.length,
      activeRequests: this.activeRequests.size,
      lastAnalysisTime: this.lastAnalysisTime,
      timeSinceLastAnalysis: Date.now() - this.lastAnalysisTime,
    };
  }

  /**
   * Check if analysis is currently in progress
   */
  isAnalyzing(): boolean {
    return this.activeRequests.size > 0;
  }

  /**
   * Get current queue length
   */
  getQueueLength(): number {
    return this.queue.length;
  }
}

// Singleton instance for the editor
// Optimized for real-time AI suggestions with smart rate limiting
export const editorAnalysisQueue = new AnalysisQueue({
  maxWaitTime: 800, // Process quickly for responsive suggestions
  minInterval: 400, // Short interval for real-time feel
  maxConcurrent: 1, // Only one analysis at a time for coherent suggestions
  enableBatching: true,
});
