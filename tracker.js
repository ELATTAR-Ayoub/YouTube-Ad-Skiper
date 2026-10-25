// Count ad transitions after our action, not repeated click/seek attempts.
(() => {
  class SkipAdTracker {
    constructor(newId = () => crypto.randomUUID()) {
      this.newId=newId; this.current=null; this.completed=[]; this.page=null; this.lastClosed=null;
    }
    finish() {
      if (this.current?.acted && !this.current.counted) {
        this.completed.push({id:this.current.id,completedAt:Date.now()}); this.current.counted=true;
      }
      if (this.current) this.lastClosed={...this.current,closedAt:Date.now()};
      this.current=null;
    }
    observe(sample) {
      if (this.page !== null && this.page !== sample.page) { this.current=null; this.lastClosed=null; }
      this.page=sample.page;
      if (!sample.isAd) { this.finish(); return null; }
      const previous=this.current?.last;
      let changed=false;
      if (previous && !sample.endCard) {
        changed=!!((sample.pod && previous.pod && sample.pod!==previous.pod) ||
          (sample.src && previous.src && sample.src!==previous.src) ||
          (!previous.seeking && !sample.seeking && previous.time>2 && sample.time+0.75<previous.time));
      }
      if (changed) this.finish();
      if (!this.current) {
        // YouTube may remove ad-showing for a frame before mounting the end
        // card. Reuse that ad's ID so this extra dismiss is never counted twice.
        if (sample.endCard && this.lastClosed && Date.now()-this.lastClosed.closedAt<10000) {
          this.current={...this.lastClosed};
        } else {
          this.current={id:this.newId(),acted:false,counted:false,last:sample};
          this.lastClosed=null;
        }
      }
      this.current.last=sample;
      return this.current.id;
    }
    markAction(id) { if (this.current?.id===id) this.current.acted=true; }
    takeCompleted() { return this.completed.splice(0); }
  }
  globalThis.SkipAdTracker=SkipAdTracker;
})();
