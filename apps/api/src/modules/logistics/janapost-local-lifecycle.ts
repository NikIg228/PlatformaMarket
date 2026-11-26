export type JanaPostLocalTracking = "CREATED" | "arrival_branch" | "delivered";

export interface JanaPostLocalCarrier {
  create(input: { mailNo: string; stationCode: string }): Promise<void>;
  track(mailNo: string): Promise<JanaPostLocalTracking | null>;
  label(mailNo: string): Promise<Buffer>;
}

type Attempt = {
  mailNo: string;
  stationCode: string;
  creation: "pending" | "unknown" | "confirmed";
  tracking: JanaPostLocalTracking | null;
};

// A fixture runner keeps attempts for one local scenario in memory.
export class JanaPostLocalLifecycle {
  private readonly attempts = new Map<string, Attempt>();
  private readonly reservedTracks = new Set<string>();

  constructor(private readonly carrier: JanaPostLocalCarrier) {}

  async create(shipmentId: string, mailNo: string, stationCode: string): Promise<Attempt> {
    const previous = this.attempts.get(shipmentId);
    if (previous) {
      if (previous.mailNo !== mailNo || previous.stationCode !== stationCode) {
        throw new Error("The existing attempt has different shipment details");
      }
      return { ...previous };
    }
    if (this.reservedTracks.has(mailNo)) throw new Error("The track belongs to another shipment");
    this.reservedTracks.add(mailNo);
    const attempt: Attempt = { mailNo, stationCode, creation: "pending", tracking: null };
    this.attempts.set(shipmentId, attempt);

    try {
      await this.carrier.create({ mailNo, stationCode });
      attempt.creation = "confirmed";
    } catch {
      attempt.creation = "unknown";
    }
    return { ...attempt };
  }

  async refresh(shipmentId: string): Promise<Attempt> {
    const attempt = this.requireAttempt(shipmentId);
    if (attempt.creation === "pending") return { ...attempt };

    const tracking = await this.carrier.track(attempt.mailNo);
    if (tracking) {
      attempt.creation = "confirmed";
      attempt.tracking = tracking;
    }
    return { ...attempt };
  }

  async label(shipmentId: string): Promise<Buffer> {
    const attempt = this.requireAttempt(shipmentId);
    if (attempt.creation !== "confirmed") throw new Error("Confirm the shipment before requesting its label");
    return this.carrier.label(attempt.mailNo);
  }

  private requireAttempt(shipmentId: string): Attempt {
    const attempt = this.attempts.get(shipmentId);
    if (!attempt) throw new Error("No shipment attempt was found");
    return attempt;
  }
}
