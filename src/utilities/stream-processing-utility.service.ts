import { Injectable } from "@nestjs/common";
import { StreamDataDto } from "src/dto/stream-data.dto";
import { IIntervals } from "src/interfaces/intervals.interface";
import { IRelativePinchStream } from "src/interfaces/relative-pinch-stream.interface";
import { IStreamData } from "src/interfaces/stream-data.interface";

@Injectable()
export class StreamProcessingUtility {
  streamTypeDefiner(streamsData: StreamDataDto): IStreamData[] {
    const streams = streamsData.streams;
    for (let stream of streams) {
      stream.inletTemp > stream.outletTemp
        ? (stream.streamType = "hot")
        : (stream.streamType = "cold");
      stream.flowHeatCapacity = stream.heatCapacity * stream.massFlow;
    }

    return streams;
  }

  shiftedStreamMaker(streams: IStreamData[]): IStreamData[] {
    const shiftedStreams = [];
    // Если просто спред оператором приравнять списки shiftedStreams и streams, то они начинают по всему
    // проекту приравниваться. Прототипы и всякое такое
    for (let stream of streams) {
      shiftedStreams.push({
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

    for (let stream of shiftedStreams) {
      if (stream.streamType === "hot") {
        stream.inletTemp = stream.inletTemp - stream.deltaT / 2;
        stream.outletTemp = stream.outletTemp - stream.deltaT / 2;
      } else {
        stream.inletTemp = stream.inletTemp + stream.deltaT / 2;
        stream.outletTemp = stream.outletTemp + stream.deltaT / 2;
      }
    }
    return shiftedStreams;
  }

  intervalMaker(streams: IStreamData[]): IIntervals[] {
    const tempArray: number[] = [];
    const intervals: IIntervals[] = [];
    for (let stream of streams) {
      tempArray.push(stream.inletTemp);
      tempArray.push(stream.outletTemp);
    }

    // bubble sort
    for (let i = 0; i < tempArray.length; i++) {
      for (let j = 0; j < tempArray.length - i - 1; j++) {
        if (tempArray[j] < tempArray[j + 1]) {
          let leftHand = tempArray[j];
          tempArray[j] = tempArray[j + 1];
          tempArray[j + 1] = leftHand;
        }
      }
    }

    for (let i = 0; i < tempArray.length - 1; i++) {
      intervals.push({
        id: i,
        start: tempArray[i],
        end: tempArray[i + 1],
        deltaT: tempArray[i] - tempArray[i + 1],
        streamId: [],
        heatCapDivision: 0,
        deltaH: 0,
        heatStatus: "",
        incomingHeat: 0,
        outgoingHeat: 0,
      });
    }

    return intervals;
  }

  streamsRelativlyPinch(
    streams: IStreamData[],
    hotPinchPoint: number,
    coldPinchPoint: number,
  ): IRelativePinchStream[] {
    const relativPinchStreams: IRelativePinchStream[] = [];
    for (let stream of streams) {
      if (stream.streamType === "hot" && stream.outletTemp !== hotPinchPoint) {
        relativPinchStreams.push({
          parentId: stream.id,
          inletTemp: stream.inletTemp,
          outletTemp: hotPinchPoint,
          massFlow: stream.massFlow,
          heatCapacity: stream.heatCapacity,
          flowHeatCapacity: stream.flowHeatCapacity,
          streamType: stream.streamType,
          relativePinch: "above",
        });
        relativPinchStreams.push({
          parentId: stream.id,
          inletTemp: hotPinchPoint,
          outletTemp: stream.outletTemp,
          massFlow: stream.massFlow,
          heatCapacity: stream.heatCapacity,
          flowHeatCapacity: stream.flowHeatCapacity,
          streamType: stream.streamType,
          relativePinch: "below",
        });
      } else if (stream.streamType === "cold" && stream.inletTemp !== coldPinchPoint) {
        relativPinchStreams.push({
          parentId: stream.id,
          inletTemp: coldPinchPoint,
          outletTemp: stream.outletTemp,
          massFlow: stream.massFlow,
          heatCapacity: stream.heatCapacity,
          flowHeatCapacity: stream.flowHeatCapacity,
          streamType: stream.streamType,
          relativePinch: "above",
        });
        relativPinchStreams.push({
          parentId: stream.id,
          inletTemp: stream.inletTemp,
          outletTemp: coldPinchPoint,
          massFlow: stream.massFlow,
          heatCapacity: stream.heatCapacity,
          flowHeatCapacity: stream.flowHeatCapacity,
          streamType: stream.streamType,
          relativePinch: "below",
        });
      }
    }

    return relativPinchStreams;
  }
}
