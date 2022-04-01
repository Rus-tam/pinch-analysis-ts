export interface IHeatExchanger {
  hotStreamId: number;
  coldStreamId: number;
  deltaH: number;
  inletTempHot: number;
  outletTempHot: number;
  inletTempCold: number;
  outletTempCold: number;
}
