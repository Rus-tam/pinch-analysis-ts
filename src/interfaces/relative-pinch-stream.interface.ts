export interface IRelativePinchStream {
  parentId: number;
  inletTemp: number;
  outletTemp: number;
  massFlow: number;
  heatCapacity: number;
  flowHeatCapacity: number;
  streamType: string;
  relativePinch: string;
  potentialHeat?: number;
}
