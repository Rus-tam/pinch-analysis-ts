export interface IIntervals {
  id: number;
  start: number;
  end: number;
  deltaT: number;
  streamId: number[];
  heatCapDivision: number;
  deltaH: number;
  heatStatus: string;
  incomingHeatV1: number;
  outgoingHeatV1: number;
  incomingHeat: number;
  outgoingHeat: number;
}
