import { Injectable } from "@nestjs/common";
import { interval } from "rxjs";
import { StreamDto } from "./dto/stream.dto";
import { IStreamData } from "./interfaces/stream-data.interface";
import { IUtils } from "./interfaces/utils.interface";
import { ExchangerSetupUtility } from "./utilities/exchanger-setup-utility.service";
import { StreamProcessingUtility } from "./utilities/stream-processing-utility.service";

@Injectable()
export class AppService {
  constructor(
    private readonly streamProcUtility: StreamProcessingUtility,
    private readonly exchangerSetupUtility: ExchangerSetupUtility,
  ) {}

  pinchPointFinder(streams: IStreamData[]): {
    hotPinchPoint: number;
    coldPinchPoint: number;
    hotUtilitiesAmount: number;
    coldUtilitiesAmount: number;
  } {
    let streamId: number[] = [];
    let hotFlowHeatCap = 0;
    let coldFlowHeatCap = 0;
    let isNegativeValue = false;
    let minValue = 0;
    let pinchPoint = 0;
    let coldPinchPoint = 0;
    let hotPinchPoint = 0;
    let hotUtilitiesAmount = 0;
    let coldUtilitiesAmount = 0;
    const shiftedStreams = this.streamProcUtility.shiftedStreamMaker(streams);
    const intervals = this.streamProcUtility.intervalMaker(shiftedStreams);

    // Тут будут храниться данные о потоках чьи температуры выставлены в порядке возрастания
    const modifiedStreams: IStreamData[] = [];
    for (let stream of shiftedStreams) {
      modifiedStreams.push({
        id: stream.id,
        inletTemp: stream.inletTemp,
        outletTemp: stream.outletTemp,
        massFlow: stream.massFlow,
        heatCapacity: stream.heatCapacity,
        flowHeatCapacity: stream.flowHeatCapacity,
        streamType: stream.streamType,
        deltaT: stream.deltaT,
      });
    }
    for (let stream of modifiedStreams) {
      if (stream.inletTemp > stream.outletTemp) {
        let temp = stream.inletTemp;
        stream.inletTemp = stream.outletTemp;
        stream.outletTemp = temp;
      }
    }

    for (let i = 0; i < intervals.length; i++) {
      for (let j = 0; j < modifiedStreams.length; j++) {
        if (intervals[i].start > modifiedStreams[j].inletTemp && intervals[i].end < modifiedStreams[j].outletTemp) {
          streamId.push(modifiedStreams[j].id);
          if (modifiedStreams[j].streamType === "hot") {
            hotFlowHeatCap += modifiedStreams[j].flowHeatCapacity;
          } else if (modifiedStreams[j].streamType === "cold") {
            coldFlowHeatCap += modifiedStreams[j].flowHeatCapacity;
          }
        }
      }
      intervals[i].streamId = streamId;
      intervals[i].heatCapDivision = coldFlowHeatCap - hotFlowHeatCap;
      intervals[i].deltaH = intervals[i].deltaT * intervals[i].heatCapDivision;
      intervals[i].deltaH < 0 ? (intervals[i].heatStatus = "heatExcess") : (intervals[i].heatStatus = "heatLack");
      if (i === 0) {
        intervals[i].incomingHeatV1 = 0;
        intervals[i].outgoingHeatV1 = intervals[i].incomingHeatV1 - intervals[i].deltaH;
        intervals[i].incomingHeatV1 < 0 && intervals[i].outgoingHeatV1 < 0 ? (isNegativeValue = true) : null;
      } else {
        intervals[i].incomingHeatV1 = intervals[i - 1].outgoingHeatV1;
        intervals[i].outgoingHeatV1 = intervals[i].incomingHeatV1 - intervals[i].deltaH;
        intervals[i].incomingHeatV1 < 0 && intervals[i].outgoingHeatV1 < 0 ? (isNegativeValue = true) : null;
      }
      minValue > intervals[i].outgoingHeatV1 ? (minValue = intervals[i].outgoingHeatV1) : null;
      streamId = [];
      hotFlowHeatCap = 0;
      coldFlowHeatCap = 0;
    }

    console.log(intervals[2]);
    // console.log(minValue);

    // Округление значений интервалов
    const roundedIntervals = this.streamProcUtility.roundValues(intervals);

    console.log(roundedIntervals[2]);

    if (isNegativeValue) {
      for (let i = 0; i < roundedIntervals.length; i++) {
        minValue = minValue * -1;
        if (i === 0) {
          roundedIntervals[i].incomingHeat = parseFloat(minValue.toFixed(2));
          roundedIntervals[i].outgoingHeat = parseFloat(
            (roundedIntervals[i].incomingHeat - roundedIntervals[i].deltaH).toFixed(2),
          );
        } else {
          roundedIntervals[i].incomingHeat = parseFloat(roundedIntervals[i - 1].outgoingHeat.toFixed(2));
          roundedIntervals[i].outgoingHeat = parseFloat(
            (roundedIntervals[i].incomingHeat - roundedIntervals[i].deltaH).toFixed(2),
          );
        }

        if (roundedIntervals[i].outgoingHeat === 0) {
          pinchPoint = roundedIntervals[i].end;
          hotPinchPoint = parseFloat((pinchPoint + modifiedStreams[0].deltaT / 2).toFixed(2));
          coldPinchPoint = parseFloat((pinchPoint - modifiedStreams[0].deltaT / 2).toFixed(2));
        }
      }
    }

    console.log(roundedIntervals);

    hotUtilitiesAmount = roundedIntervals[0].incomingHeat;
    coldUtilitiesAmount = roundedIntervals[roundedIntervals.length - 1].outgoingHeat;

    return { hotPinchPoint, coldPinchPoint, hotUtilitiesAmount, coldUtilitiesAmount };
  }

  exchangerSetup(streams: IStreamData[]) {
    let deltaHhot = 0;
    let deltaHcold = 0;
    let deltaHres = 0;

    const { hotPinchPoint, coldPinchPoint } = this.pinchPointFinder(streams);
    const streamRelPinch = this.streamProcUtility.streamsRelativlyPinch(streams, hotPinchPoint, coldPinchPoint);
    let { hotStreamsTopSplited, coldStreamsTopSplited, hotStreamsBotSplited, coldStreamsBotSplited } =
      this.streamProcUtility.streamSpliting(streamRelPinch);

    // Расставляем теплообменники рядом с пинчом
    let { hotStreamsTop, coldStreamsTop, heatExchAbove } = this.exchangerSetupUtility.pinchNearHESetupAbove(
      hotStreamsTopSplited,
      coldStreamsTopSplited,
    );
    let { hotStreamsBot, coldStreamsBot, heatExchBelow } = this.exchangerSetupUtility.pinchNearHESetupBelow(
      hotStreamsBotSplited,
      coldStreamsBotSplited,
    );

    // Раставляем теплообменники ниже пинча
    for (let i = 0; i < hotStreamsBot.length; i++) {
      if (coldStreamsBot[i] !== undefined) {
        deltaHhot = hotStreamsBot[i].flowHeatCapacity * (hotStreamsBot[i].outletTemp - hotStreamsBot[i].inletTemp);
        deltaHcold = coldStreamsBot[i].flowHeatCapacity * (coldStreamsBot[i].outletTemp - coldStreamsBot[i].inletTemp);

        // Находим наименьшее значение энтальпии
        deltaHres = this.exchangerSetupUtility.minEntalphy(deltaHhot, deltaHcold);

        // Определяем теплообменник
        heatExchBelow.push({
          hotStreamId: hotStreamsBot[i].parentId,
          coldStreamId: coldStreamsBot[i].parentId,
          deltaH: deltaHres,
          inletTempHot: hotStreamsBot[i].inletTemp,
          outletTempHot: hotStreamsBot[i].inletTemp - deltaHres / hotStreamsBot[i].flowHeatCapacity,
          inletTempCold: coldStreamsBot[i].outletTemp - deltaHres / coldStreamsBot[i].flowHeatCapacity,
          outletTempCold: coldStreamsBot[i].outletTemp,
        });

        // Изменяем взаимодействующие потоки
        hotStreamsBot[i].inletTemp = hotStreamsBot[i].inletTemp - deltaHres / hotStreamsBot[i].flowHeatCapacity;
        hotStreamsBot[i].potentialHeat = hotStreamsBot[i].potentialHeat - deltaHres;
        coldStreamsBot[i].outletTemp = coldStreamsBot[i].outletTemp - deltaHres / coldStreamsBot[i].flowHeatCapacity;
        coldStreamsBot[i].potentialHeat = coldStreamsBot[i].potentialHeat - deltaHres;
      }
    }

    // Фильтруем список потоков
    hotStreamsBot = hotStreamsBot.filter((stream) => stream.potentialHeat > 0.1);
    coldStreamsBot = coldStreamsBot.filter((stream) => stream.potentialHeat > 0.1);

    // Расставляем холодные утилиты ниже пинча
    // if (hotStreamsBot.length !== 0) {
    //   for (let stream of hotStreamsBot) {
    //     coldUtils.push({
    //       streamId: stream.parentId,
    //       deltaH: stream.potentialHeat,
    //       inletTemp: stream.inletTemp,
    //       outletTemp: stream.outletTemp,
    //       status: "good",
    //     });
    //   }
    // }

    // Расставляем холодные утилиты выше пинча, если не удалось рекуперировать все тепло горячих потоков
    // Это вынужденная мера. Выше пинча холодных утилит не должно быть

    // Расставляем теплообменники выше пинча
    for (let i = 0; i < coldStreamsTop.length; i++) {
      if (hotStreamsTop[i] !== undefined) {
        deltaHhot = hotStreamsTop[i].flowHeatCapacity * (hotStreamsTop[i].outletTemp - hotStreamsTop[i].inletTemp);
        deltaHcold = coldStreamsTop[i].flowHeatCapacity * (coldStreamsTop[i].outletTemp - coldStreamsTop[i].inletTemp);

        // Находим наименьшее значение энтальпии
        deltaHres = this.exchangerSetupUtility.minEntalphy(deltaHhot, deltaHcold);

        // Определяем теплообменник
        heatExchAbove.push({
          hotStreamId: hotStreamsTop[i].parentId,
          coldStreamId: coldStreamsTop[i].parentId,
          deltaH: deltaHres,
          inletTempHot: hotStreamsTop[i].outletTemp + deltaHres / hotStreamsTop[i].flowHeatCapacity,
          outletTempHot: hotStreamsTop[i].outletTemp,
          inletTempCold: coldStreamsTop[i].inletTemp,
          outletTempCold: coldStreamsTop[i].inletTemp + deltaHres / coldStreamsTop[i].flowHeatCapacity,
        });

        // Изменяем взаимодействующие потоки
        hotStreamsTop[i].outletTemp = hotStreamsTop[i].outletTemp + deltaHres / hotStreamsTop[i].flowHeatCapacity;
        hotStreamsTop[i].potentialHeat = hotStreamsTop[i].potentialHeat - deltaHres;
        coldStreamsTop[i].inletTemp = coldStreamsTop[i].inletTemp + deltaHres / coldStreamsTop[i].flowHeatCapacity;
        coldStreamsTop[i].potentialHeat = coldStreamsTop[i].potentialHeat - deltaHres;
      }
    }

    // Фильтруем список потоков
    hotStreamsTop = hotStreamsTop.filter((stream) => stream.potentialHeat > 0.1);
    coldStreamsTop = coldStreamsTop.filter((stream) => stream.potentialHeat > 0.1);

    // Расставляем горячие утилиты выше пинча
    // if (coldStreamsTop.length !== 0) {
    //   for (let stream of coldStreamsTop) {
    //     hotUtils.push({
    //       streamId: stream.parentId,
    //       deltaH: stream.potentialHeat,
    //       inletTemp: stream.inletTemp,
    //       outletTemp: stream.outletTemp,
    //       status: "good",
    //     });
    //   }
    // }

    // Расставляем холодные утилиты выше пинча, если не удалось рекуперировать все тепло горячих потоков
    // Это вынужденная мера. Выше пинча холодных утилит не должно быть
    // if (hotStreamsTop.length !== 0) {
    //   for (let stream of hotStreamsTop) {
    //     coldUtils.push({
    //       streamId: stream.parentId,
    //       deltaH: stream.potentialHeat,
    //       inletTemp: stream.inletTemp,
    //       outletTemp: stream.outletTemp,
    //       status: "bad",
    //     });
    //   }
    // }

    // Расставляем холодные и горячие утилиты
    let { hotUtils, coldUtils } = this.exchangerSetupUtility.utilsSetup(
      hotStreamsTop,
      coldStreamsTop,
      hotStreamsBot,
      coldStreamsBot,
    );

    return { heatExchAbove, heatExchBelow, hotUtils, coldUtils };
  }
}
