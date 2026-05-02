const TYPE_WEIGHT = {
  Placement: 3,
  Result: 2,
  Event: 1
};

class MinHeap {
  constructor(compareFn) {
    this.compareFn = compareFn;
    this.items = [];
  }

  size() {
    return this.items.length;
  }

  peek() {
    return this.items[0];
  }

  push(value) {
    this.items.push(value);
    this.bubbleUp(this.items.length - 1);
  }

  pop() {
    if (this.items.length === 0) return undefined;
    if (this.items.length === 1) return this.items.pop();

    const first = this.items[0];
    this.items[0] = this.items.pop();
    this.bubbleDown(0);
    return first;
  }

  bubbleUp(index) {
    let current = index;
    while (current > 0) {
      const parent = Math.floor((current - 1) / 2);
      if (this.compareFn(this.items[current], this.items[parent]) >= 0) {
        break;
      }

      [this.items[current], this.items[parent]] = [this.items[parent], this.items[current]];
      current = parent;
    }
  }

  bubbleDown(index) {
    let current = index;
    const length = this.items.length;

    while (true) {
      const left = current * 2 + 1;
      const right = current * 2 + 2;
      let smallest = current;

      if (left < length && this.compareFn(this.items[left], this.items[smallest]) < 0) {
        smallest = left;
      }

      if (right < length && this.compareFn(this.items[right], this.items[smallest]) < 0) {
        smallest = right;
      }

      if (smallest === current) {
        break;
      }

      [this.items[current], this.items[smallest]] = [this.items[smallest], this.items[current]];
      current = smallest;
    }
  }
}

function getTypeWeight(type) {
  return TYPE_WEIGHT[type] || 0;
}

function toMillis(value) {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
}

function toPriorityItem(notification) {
  const typeWeight = getTypeWeight(notification.Type || notification.type);
  const timestamp = toMillis(notification.Timestamp || notification.timestamp);
  const isRead = Boolean(notification.isRead);

  return {
    id: notification.ID || notification.id || "",
    type: notification.Type || notification.type || "Unknown",
    message: notification.Message || notification.message || "",
    timestamp: notification.Timestamp || notification.timestamp || "",
    isRead,
    typeWeight,
    timestampMs: timestamp,
    // type weight is primary. recency is secondary tie-break.
    score: typeWeight * 10_000_000_000_000 + timestamp
  };
}

function compareByScoreAscending(a, b) {
  return a.score - b.score;
}

function compareByScoreDescending(a, b) {
  return b.score - a.score;
}

function selectTopPriorityNotifications(notifications, topN = 10) {
  const heap = new MinHeap(compareByScoreAscending);

  for (const raw of notifications) {
    const item = toPriorityItem(raw);
    if (item.isRead) {
      continue;
    }

    if (heap.size() < topN) {
      heap.push(item);
      continue;
    }

    const smallestInTop = heap.peek();
    if (item.score > smallestInTop.score) {
      heap.pop();
      heap.push(item);
    }
  }

  return [...heap.items].sort(compareByScoreDescending);
}

class PriorityInboxStore {
  constructor(topN = 10) {
    this.topN = topN;
    this.heap = new MinHeap(compareByScoreAscending);
  }

  addNotifications(notifications) {
    for (const raw of notifications) {
      const item = toPriorityItem(raw);
      if (item.isRead) continue;

      if (this.heap.size() < this.topN) {
        this.heap.push(item);
        continue;
      }

      if (item.score > this.heap.peek().score) {
        this.heap.pop();
        this.heap.push(item);
      }
    }
  }

  getSnapshot() {
    return [...this.heap.items].sort(compareByScoreDescending);
  }
}

module.exports = {
  TYPE_WEIGHT,
  selectTopPriorityNotifications,
  PriorityInboxStore
};

