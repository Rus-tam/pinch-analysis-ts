import { Injectable } from "@nestjs/common";
import { StreamDataDto } from "./dto/stream-data.dto";
import { IStreamData } from "./interfaces/stream-data.interface";
import { StreamProcessingUtility } from "./utilities/stream-processing-utility.service";

@Injectable()
export class AppService {
  constructor(private readonly streamProcUtility: StreamProcessingUtility) {}

  pinchPointFinder(streamsData: StreamDataDto): {
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
    const { streams, shiftedStreams } = this.shiftedStreamMaker(streamsData);
    const intervals = this.streamProcUtility.intervalMaker(streams);
    // Тут будут храниться данные о потоках чьи температуры выставлены в порядке возрастания
    const modifiedStreams: IStreamData[] = [...streams];
    for (let stream of modifiedStreams) {
      if (stream.inletTemp > stream.outletTemp) {
        let temp = stream.inletTemp;
        stream.inletTemp = stream.outletTemp;
        stream.outletTemp = temp;
      }
    }

    for (let i = 0; i < intervals.length; i++) {
      for (let j = 0; j < modifiedStreams.length; j++) {
        if (
          intervals[i].start > modifiedStreams[j].inletTemp &&
          intervals[i].end < modifiedStreams[j].outletTemp
        ) {
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
      intervals[i].deltaH < 0
        ? (intervals[i].heatStatus = "heatExcess")
        : (intervals[i].heatStatus = "heatLack");
      if (i === 0) {
        intervals[i].incomingHeat = 0;
        intervals[i].outgoingHeat = intervals[i].incomingHeat - intervals[i].deltaH;
        intervals[i].incomingHeat < 0 && intervals[i].outgoingHeat < 0
          ? (isNegativeValue = true)
          : null;
      } else {
        intervals[i].incomingHeat = intervals[i - 1].outgoingHeat;
        intervals[i].outgoingHeat = intervals[i].incomingHeat - intervals[i].deltaH;
        intervals[i].incomingHeat < 0 && intervals[i].outgoingHeat < 0
          ? (isNegativeValue = true)
          : null;
      }
      minValue > intervals[i].outgoingHeat ? (minValue = intervals[i].outgoingHeat) : null;
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

  private shiftedStreamMaker(streamsData: StreamDataDto): {
    streams: IStreamData[];
    shiftedStreams: IStreamData[];
  } {
    const streams = this.streamProcUtility.streamTypeDefiner(streamsData);
    const shiftedStreams = this.streamProcUtility.shiftedStreamMaker(streams);

    return { streams, shiftedStreams };
  }
}
