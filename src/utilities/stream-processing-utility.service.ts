import { Injectable } from "@nestjs/common";
import { StreamDataDto } from "src/dto/stream-data.dto";
import { StreamDto } from "src/dto/stream.dto";
import { IIntervals } from "src/interfaces/intervals.interface";
import { IRelativePinchStream } from "src/interfaces/relative-pinch-stream.interface";
import { IStreamData } from "src/interfaces/stream-data.interface";

@Injectable()
export class StreamProcessingUtility {
  streamTypeDefiner(streamsData: StreamDataDto): IStreamData[] {
    const streams: IStreamData[] = [];
    const str = streamsData.streams;
    for (let elem of str) {
      streams.push({
        id: elem.id,
        inletTemp: parseFloat(elem.inletTemp),
        outletTemp: parseFloat(elem.outletTemp),
        massFlow: parseFloat(elem.massFlow),
        heatCapacity: parseFloat(elem.heatCapacity),
        flowHeatCapacity: parseFloat(elem.flowHeatCapacity),
        streamType: elem.streamType,
        deltaT: elem.deltaT,
      });
    }
    for (let stream of streams) {
      stream.inletTemp > stream.outletTemp
        ? (stream.streamType = "hot")
        : (stream.streamType = "cold");
      stream.flowHeatCapacity = stream.heatCapacity * stream.massFlow;
    }

    return streams;
  }

  shiftedStreamMaker(streams: IStreamData[]): IStreamData[] {
    const shiftedStreams: IStreamData[] = [];
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
        incomingHeatV1: 0,
        outgoingHeatV1: 0,
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
    let relativPinchStreams: IRelativePinchStream[] = [];
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

    relativPinchStreams = relativPinchStreams.filter(
      (stream) => stream.inletTemp !== stream.outletTemp,
    );

    return relativPinchStreams;
  }

  streamSpliting(relativePinchStreams: IRelativePinchStream[]): {
    hotStreamsTop: IRelativePinchStream[];
    coldStreamsTop: IRelativePinchStream[];
    hotStreamsBot: IRelativePinchStream[];
    coldStreamsBot: IRelativePinchStream[];
  } {
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

    console.log(relativePinchStreams);

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
      while (hotStreamsTop.length >= coldStreamsTop.length) {
        let { streamOne, streamTwo } = this.streamSplitter(coldStreamsTop[iterator]);
        let index = coldStreamsTop.indexOf(coldStreamsTop[iterator]);
        coldStreamsTop = coldStreamsTop.filter((stream) => stream !== coldStreamsTop[index]);
        coldStreamsTop.push(streamOne);
        coldStreamsTop.push(streamTwo);
        coldStreamsTop = this.streamSortingByCp(coldStreamsTop);
        iterator++;
      }
    }

    // Ниже Пинча
    if (hotStreamsBelow.length >= coldStreamsBelow.length) {
      hotStreamsBot = this.streamSortingByCp(hotStreamsBelow);
      coldStreamsBot = this.streamSortingByCp(coldStreamsBelow);

      let iterator = 0;
      while (
        hotStreamsBot[iterator].flowHeatCapacity <= coldStreamsBot[iterator].flowHeatCapacity
      ) {
        let { streamOne, streamTwo } = this.streamSplitter(coldStreamsBot[iterator]);
        let index = coldStreamsBot.indexOf(coldStreamsBot[iterator]);
        coldStreamsBot = coldStreamsBot.filter((stream) => stream !== coldStreamsBot[index]);
        coldStreamsBot.push(streamOne);
        coldStreamsBot.push(streamTwo);
        coldStreamsBot = this.streamSortingByCp(coldStreamsBot);

        iterator++;
      }
    } else {
      let iterator = 0;

      hotStreamsBot = this.streamSortingByCp(hotStreamsBelow);
      coldStreamsBot = this.streamSortingByCp(coldStreamsBelow);

      while (hotStreamsBot.length >= coldStreamsBot.length) {
        let { streamOne, streamTwo } = this.streamSplitter(hotStreamsBot[iterator]);
        let index = hotStreamsBot.indexOf(hotStreamsBot[iterator]);
        hotStreamsBot = hotStreamsBot.filter((stream) => stream !== hotStreamsBot[index]);
        hotStreamsBot.push(streamOne);
        hotStreamsBot.push(streamTwo);
        hotStreamsBot = this.streamSortingByCp(hotStreamsBot);

        iterator++;
      }
    }

    return { hotStreamsTop, coldStreamsTop, hotStreamsBot, coldStreamsBot };
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
