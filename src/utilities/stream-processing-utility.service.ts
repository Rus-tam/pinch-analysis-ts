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
      if (stream.streamType === "hot" && stream.outletTemp <= hotPinchPoint) {
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
      } else if (stream.streamType === "hot" && stream.outletTemp > hotPinchPoint) {
        relativPinchStreams.push({
          parentId: stream.id,
          inletTemp: stream.inletTemp,
          outletTemp: stream.outletTemp,
          massFlow: stream.massFlow,
          heatCapacity: stream.heatCapacity,
          flowHeatCapacity: stream.flowHeatCapacity,
          streamType: stream.streamType,
          relativePinch: "above",
        });
      } else if (stream.streamType === "cold" && stream.inletTemp <= coldPinchPoint) {
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
      } else if (stream.streamType === "cold" && stream.inletTemp > coldPinchPoint) {
        relativPinchStreams.push({
          parentId: stream.id,
          inletTemp: stream.inletTemp,
          outletTemp: stream.outletTemp,
          massFlow: stream.massFlow,
          heatCapacity: stream.heatCapacity,
          flowHeatCapacity: stream.flowHeatCapacity,
          streamType: stream.streamType,
          relativePinch: "above",
        });
      }
    }

    return relativPinchStreams;
  }

  streamSpliting(relativePinchStreams: IRelativePinchStream[]) {
    const coldStreamsAbove: IRelativePinchStream[] = [];
    const coldStreamsBelow: IRelativePinchStream[] = [];
    const hotStreamsAbove: IRelativePinchStream[] = [];
    const hotStreamsBelow: IRelativePinchStream[] = [];
    let coldStreamsTop: IRelativePinchStream[] = [];
    let hotStreamsTop: IRelativePinchStream[] = [];
    let coldStreamsBot: IRelativePinchStream[] = [];
    let hotStreamsBot: IRelativePinchStream[] = [];

    relativePinchStreams.forEach((stream) => {
      if (stream.relativePinch === "above" && stream.streamType === "cold") {
        coldStreamsAbove.push(stream);
      } else if (stream.relativePinch === "below" && stream.streamType === "cold") {
        coldStreamsBelow.push(stream);
      } else if (stream.relativePinch === "above" && stream.streamType === "hot") {
        hotStreamsAbove.push(stream);
      } else if (stream.relativePinch === "below" && stream.streamType === "hot") {
        hotStreamsBelow.push(stream);
      }
    });

    // Выше Пинча
    if (hotStreamsAbove.length < coldStreamsAbove.length) {
      hotStreamsTop = this.streamSortingByCp(hotStreamsAbove);
      coldStreamsTop = this.streamSortingByCp(coldStreamsAbove);

      let iterator = 0;
      while (hotStreamsTop[iterator].flowHeatCapacity > coldStreamsTop[iterator].flowHeatCapacity) {
        let { streamOne, streamTwo } = this.streamSplitter(hotStreamsTop[iterator]);
        let index = hotStreamsTop.indexOf(hotStreamsTop[iterator]);
        hotStreamsTop = hotStreamsTop.filter((stream) => stream !== hotStreamsTop[index]);
        hotStreamsTop.push(streamOne);
        hotStreamsTop.push(streamTwo);
        hotStreamsTop = this.streamSortingByCp(hotStreamsTop);

        iterator++;
      }
    } else {
      let iterator = 0;
      hotStreamsTop = this.streamSortingByCp(hotStreamsAbove);
      coldStreamsTop = this.streamSortingByCp(coldStreamsAbove);
      while (hotStreamsAbove.length >= coldStreamsAbove.length) {
        let { streamOne, streamTwo } = this.streamSplitter(coldStreamsTop[iterator]);
        let index = coldStreamsTop.indexOf(coldStreamsTop[iterator]);
        coldStreamsTop = coldStreamsTop.filter((stream) => stream !== coldStreamsTop[index]);
        coldStreamsTop.push(streamOne);
        coldStreamsTop.push(streamTwo);
        coldStreamsTop = this.streamSortingByCp(coldStreamsTop);
        iterator++;
      }
    }
  }

  streamSplitter(stream: IRelativePinchStream): {
    streamOne: IRelativePinchStream;
    streamTwo: IRelativePinchStream;
  } {
    const streamOne: IRelativePinchStream = {
      parentId: stream.parentId,
      inletTemp: stream.inletTemp,
      outletTemp: stream.outletTemp,
      massFlow: (stream.massFlow * 2) / 3,
      heatCapacity: stream.heatCapacity,
      flowHeatCapacity: (stream.flowHeatCapacity * 2) / 3,
      streamType: stream.streamType,
      relativePinch: stream.relativePinch,
    };

    const streamTwo: IRelativePinchStream = {
      parentId: stream.parentId,
      inletTemp: stream.inletTemp,
      outletTemp: stream.outletTemp,
      massFlow: stream.massFlow - streamOne.massFlow,
      heatCapacity: stream.heatCapacity,
      flowHeatCapacity: stream.flowHeatCapacity - streamOne.flowHeatCapacity,
      streamType: stream.streamType,
      relativePinch: stream.relativePinch,
    };

    return { streamOne, streamTwo };
  }

  streamSortingByCp(streams: IRelativePinchStream[]): IRelativePinchStream[] {
    for (let i = 0; i < streams.length; i++) {
      for (let j = 0; j < streams.length - i - 1; j++) {
        if (streams[j].flowHeatCapacity < streams[j + 1].flowHeatCapacity) {
          let leftHand = streams[j];
          streams[j] = streams[j + 1];
          streams[j + 1] = leftHand;
        }
      }
    }
    return streams;
  }
}
