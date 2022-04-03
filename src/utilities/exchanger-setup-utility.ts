import { IHeatExchanger } from "src/interfaces/heat-exchanger.interface";
import { IRelativePinchStream } from "src/interfaces/relative-pinch-stream.interface";
import { StreamProcessingUtility } from "./stream-processing-utility.service";

export class ExchangerSetupUtility {
  constructor(private readonly streamProcUtility: StreamProcessingUtility) {}

  pinchNearHESetupBelow(
    hotStreamsBot: IRelativePinchStream[],
    coldStreamsBot: IRelativePinchStream[],
  ): { hotStreamsBot: IRelativePinchStream[]; coldStreamsBot: IRelativePinchStream[]; heatExchBelow: IHeatExchanger[] } {
    const heatExchBelow: IHeatExchanger[] = [];
    let deltaHhot = 0;
    let deltaHcold = 0;
    let deltaHres = 0;
    for (let i = 0; i < coldStreamsBot.length; i++) {
      if (hotStreamsBot[i] !== undefined) {
        if (hotStreamsBot[i].flowHeatCapacity >= coldStreamsBot[i].flowHeatCapacity) {
          // Определяем разницу энтальпий
          deltaHhot = hotStreamsBot[i].flowHeatCapacity * (hotStreamsBot[i].outletTemp - hotStreamsBot[i].inletTemp);
          deltaHcold = coldStreamsBot[i].flowHeatCapacity * (coldStreamsBot[i].outletTemp - coldStreamsBot[i].inletTemp);

          // Определяем наименьшую энтальпию и с ней работаем
          deltaHres = this.streamProcUtility.minEntalphy(deltaHhot, deltaHcold);

          // Ставим теплообменник
          heatExchBelow.push({
            hotStreamId: hotStreamsBot[i].parentId,
            coldStreamId: coldStreamsBot[i].parentId,
            deltaH: deltaHres,
            inletTempHot: hotStreamsBot[i].inletTemp,
            outletTempHot: hotStreamsBot[i].inletTemp - deltaHres / hotStreamsBot[i].flowHeatCapacity,
            inletTempCold: coldStreamsBot[i].outletTemp - deltaHres / coldStreamsBot[i].flowHeatCapacity,
            outletTempCold: coldStreamsBot[i].outletTemp,
          });

          // Изменяем температуры и тепловые потенциалы потоков
          hotStreamsBot[i].outletTemp = hotStreamsBot[i].outletTemp + deltaHres / hotStreamsBot[i].flowHeatCapacity;
          hotStreamsBot[i].potentialHeat = hotStreamsBot[i].potentialHeat - deltaHres;
          coldStreamsBot[i].outletTemp = coldStreamsBot[i].outletTemp - deltaHres / coldStreamsBot[i].flowHeatCapacity;
          coldStreamsBot[i].potentialHeat = coldStreamsBot[i].potentialHeat - deltaHres;
        }
      }
    }

    hotStreamsBot = hotStreamsBot.filter((stream) => stream.potentialHeat !== 0);
    coldStreamsBot = coldStreamsBot.filter((stream) => stream.potentialHeat !== 0);

    return { hotStreamsBot, coldStreamsBot, heatExchBelow };
  }

  pinchNearHESetupAbove(
    hotStreamsTop: IRelativePinchStream[],
    coldStreamsTop: IRelativePinchStream[],
  ): { hotStreamsTop: IRelativePinchStream[]; coldStreamsTop: IRelativePinchStream[]; heatExchAbove: IHeatExchanger[] } {
    const heatExchAbove: IHeatExchanger[] = [];
    let deltaHhot = 0;
    let deltaHcold = 0;
    let deltaHres = 0;
    for (let i = 0; i < hotStreamsTop.length; i++) {
      if (coldStreamsTop[i] !== undefined) {
        if (hotStreamsTop[i].flowHeatCapacity <= coldStreamsTop[i].flowHeatCapacity) {
          // Определяем разницу энтальпий
          deltaHhot = hotStreamsTop[i].flowHeatCapacity * (hotStreamsTop[i].outletTemp - hotStreamsTop[i].inletTemp);
          deltaHcold = coldStreamsTop[i].flowHeatCapacity * (coldStreamsTop[i].outletTemp - coldStreamsTop[i].inletTemp);

          // Определяем наименьшую энтальпию и с ней работаем
          deltaHres = this.streamProcUtility.minEntalphy(deltaHhot, deltaHcold);

          // Ставим теплообменник
          heatExchAbove.push({
            hotStreamId: hotStreamsTop[i].parentId,
            coldStreamId: coldStreamsTop[i].parentId,
            deltaH: deltaHres,
            inletTempHot: hotStreamsTop[i].outletTemp + deltaHres / hotStreamsTop[i].flowHeatCapacity,
            outletTempHot: hotStreamsTop[i].outletTemp,
            inletTempCold: coldStreamsTop[i].inletTemp,
            outletTempCold: coldStreamsTop[i].inletTemp + deltaHres / coldStreamsTop[i].flowHeatCapacity,
          });

          // Изменяем температуры и тепловые потенциалы потоков
          hotStreamsTop[i].outletTemp = hotStreamsTop[i].outletTemp + deltaHres / hotStreamsTop[i].flowHeatCapacity;
          hotStreamsTop[i].potentialHeat = hotStreamsTop[i].potentialHeat - deltaHres;
          coldStreamsTop[i].inletTemp = coldStreamsTop[i].inletTemp + deltaHres / coldStreamsTop[i].flowHeatCapacity;
          coldStreamsTop[i].potentialHeat = coldStreamsTop[i].potentialHeat - deltaHres;
        }
      }
    }

    hotStreamsTop = hotStreamsTop.filter((stream) => stream.potentialHeat !== 0);
    coldStreamsTop = coldStreamsTop.filter((stream) => stream.potentialHeat !== 0);

    return { hotStreamsTop, coldStreamsTop, heatExchAbove };
  }
}
