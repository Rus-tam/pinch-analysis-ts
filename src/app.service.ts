import { Injectable } from "@nestjs/common";
import { ConstraintMetadata } from "class-validator/types/metadata/ConstraintMetadata";
import { StreamDto } from "./dto/stream.dto";
import { IStreamData } from "./interfaces/stream-data.interface";
import { StreamProcessingUtility } from "./utilities/stream-processing-utility.service";

@Injectable()
export class AppService {
  constructor(private readonly streamProcUtility: StreamProcessingUtility) {}

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

    if (isNegativeValue) {
      for (let i = 0; i < intervals.length; i++) {
        minValue = minValue * -1;
        if (i === 0) {
          intervals[i].incomingHeat = minValue;
          intervals[i].outgoingHeat = intervals[i].incomingHeat - intervals[i].deltaH;
        } else {
          intervals[i].incomingHeat = intervals[i - 1].outgoingHeat;
          intervals[i].outgoingHeat = intervals[i].incomingHeat - intervals[i].deltaH;
        }

        if (intervals[i].outgoingHeat === 0) {
          pinchPoint = intervals[i].end;
          hotPinchPoint = pinchPoint + modifiedStreams[0].deltaT / 2;
          coldPinchPoint = pinchPoint - modifiedStreams[0].deltaT / 2;
        }
      }
    }
    hotUtilitiesAmount = intervals[0].incomingHeat;
    coldUtilitiesAmount = intervals[intervals.length - 1].outgoingHeat;

    return { hotPinchPoint, coldPinchPoint, hotUtilitiesAmount, coldUtilitiesAmount };
  }

  exchangerSetup(streams: IStreamData[]) {
    let deltaHhot = 0;
    let deltaHcold = 0;
    let deltaHres = 0;
    let hotUtils = [];

    const { hotPinchPoint, coldPinchPoint } = this.pinchPointFinder(streams);
    const streamRelPinch = this.streamProcUtility.streamsRelativlyPinch(streams, hotPinchPoint, coldPinchPoint);
    let { hotStreamsTopSplited, coldStreamsTopSplited, hotStreamsBotSplited, coldStreamsBotSplited } =
      this.streamProcUtility.streamSpliting(streamRelPinch);

    // Расставляем теплообменники рядом с пинчом
    let { hotStreamsTop, coldStreamsTop, heatExchAbove } = this.streamProcUtility.pinchNearHESetupAbove(
      hotStreamsTopSplited,
      coldStreamsTopSplited,
    );
    let { hotStreamsBot, coldStreamsBot, heatExchBelow } = this.streamProcUtility.pinchNearHESetupBelow(
      hotStreamsBotSplited,
      coldStreamsBotSplited,
    );

    for (let i = 0; i < coldStreamsTop.length; i++) {
      if (hotStreamsTop[i] !== undefined) {
        deltaHhot = hotStreamsTop[i].flowHeatCapacity * (hotStreamsTop[i].outletTemp - hotStreamsTop[i].inletTemp);
        deltaHcold = coldStreamsTop[i].flowHeatCapacity * (coldStreamsTop[i].outletTemp - coldStreamsTop[i].inletTemp);

        // Находим наименьшее значение энтальпии
        deltaHres = this.streamProcUtility.minEntalphy(deltaHhot, deltaHcold);

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

    hotStreamsTop = hotStreamsTop.filter((stream) => stream.potentialHeat > 0.1);
    coldStreamsTop = coldStreamsTop.filter((stream) => stream.potentialHeat > 0.1);

    for (let i = 0; i < coldStreamsTop.length; i++) {
      if (coldStreamsTop[i] !== undefined) {
        hotUtils.push({
          coldStreamId: coldStreamsTop[i].parentId,
          deltaH: coldStreamsTop[i].potentialHeat,
          inletTemp: coldStreamsTop[i].inletTemp,
          outletTemp: coldStreamsTop[i].outletTemp,
        });
      }
    }
  }
}
