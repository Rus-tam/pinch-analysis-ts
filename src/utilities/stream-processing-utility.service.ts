import { Injectable } from "@nestjs/common";
import { StreamDataDto } from "src/dto/stream-data.dto";
import { StreamDto } from "src/dto/stream.dto";
import { IHeatExchanger } from "src/interfaces/heat-exchanger.interface";
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
      stream.inletTemp > stream.outletTemp ? (stream.streamType = "hot") : (stream.streamType = "cold");
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

  streamsRelativlyPinch(streams: IStreamData[], hotPinchPoint: number, coldPinchPoint: number): IRelativePinchStream[] {
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

    relativPinchStreams = relativPinchStreams.filter((stream) => stream.inletTemp !== stream.outletTemp);

    return relativPinchStreams;
  }

  streamSpliting(relativePinchStreams: IRelativePinchStream[]): {
    hotStreamsTopSplited: IRelativePinchStream[];
    coldStreamsTopSplited: IRelativePinchStream[];
    hotStreamsBotSplited: IRelativePinchStream[];
    coldStreamsBotSplited: IRelativePinchStream[];
  } {
    const coldStreamsAbove: IRelativePinchStream[] = [];
    const coldStreamsBelow: IRelativePinchStream[] = [];
    const hotStreamsAbove: IRelativePinchStream[] = [];
    const hotStreamsBelow: IRelativePinchStream[] = [];
    let coldStreamsTopSplited: IRelativePinchStream[] = [];
    let hotStreamsTopSplited: IRelativePinchStream[] = [];
    let coldStreamsBotSplited: IRelativePinchStream[] = [];
    let hotStreamsBotSplited: IRelativePinchStream[] = [];

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
    if (hotStreamsAbove.length >= coldStreamsAbove.length) {
      hotStreamsTopSplited = this.streamSortingByCp(hotStreamsAbove);
      coldStreamsTopSplited = this.streamSortingByCp(coldStreamsAbove);

      let iterator = 0;
      if (hotStreamsTopSplited.length > 0 && coldStreamsTopSplited.length > 0) {
        while (hotStreamsTopSplited[iterator].flowHeatCapacity > coldStreamsTopSplited[iterator].flowHeatCapacity) {
          let { streamOne, streamTwo } = this.streamSplitter(hotStreamsTopSplited[iterator]);
          let index = hotStreamsTopSplited.indexOf(hotStreamsTopSplited[iterator]);
          hotStreamsTopSplited = hotStreamsTopSplited.filter((stream) => stream !== hotStreamsTopSplited[index]);
          hotStreamsTopSplited.push(streamOne);
          hotStreamsTopSplited.push(streamTwo);
          hotStreamsTopSplited = this.streamSortingByCp(hotStreamsTopSplited);

          iterator++;
        }
      }
    } else {
      let iterator = 0;
      hotStreamsTopSplited = this.streamSortingByCp(hotStreamsAbove);
      coldStreamsTopSplited = this.streamSortingByCp(coldStreamsAbove);
      if (hotStreamsTopSplited.length > 0 && coldStreamsTopSplited.length > 0) {
        while (hotStreamsTopSplited.length >= coldStreamsTopSplited.length) {
          let { streamOne, streamTwo } = this.streamSplitter(coldStreamsTopSplited[iterator]);
          let index = coldStreamsTopSplited.indexOf(coldStreamsTopSplited[iterator]);
          coldStreamsTopSplited = coldStreamsTopSplited.filter((stream) => stream !== coldStreamsTopSplited[index]);
          coldStreamsTopSplited.push(streamOne);
          coldStreamsTopSplited.push(streamTwo);
          coldStreamsTopSplited = this.streamSortingByCp(coldStreamsTopSplited);
          iterator++;
        }
      }
    }

    // Ниже Пинча
    if (hotStreamsBelow.length >= coldStreamsBelow.length) {
      hotStreamsBotSplited = this.streamSortingByCp(hotStreamsBelow);
      coldStreamsBotSplited = this.streamSortingByCp(coldStreamsBelow);
      if (hotStreamsBotSplited.length > 0 && coldStreamsBotSplited.length > 0) {
        let iterator = 0;
        while (hotStreamsBotSplited[iterator].flowHeatCapacity <= coldStreamsBotSplited[iterator].flowHeatCapacity) {
          let { streamOne, streamTwo } = this.streamSplitter(coldStreamsBotSplited[iterator]);
          let index = coldStreamsBotSplited.indexOf(coldStreamsBotSplited[iterator]);
          coldStreamsBotSplited = coldStreamsBotSplited.filter((stream) => stream !== coldStreamsBotSplited[index]);
          coldStreamsBotSplited.push(streamOne);
          coldStreamsBotSplited.push(streamTwo);
          coldStreamsBotSplited = this.streamSortingByCp(coldStreamsBotSplited);

          iterator++;
        }
      }
    } else {
      let iterator = 0;

      hotStreamsBotSplited = this.streamSortingByCp(hotStreamsBelow);
      coldStreamsBotSplited = this.streamSortingByCp(coldStreamsBelow);
      if (hotStreamsBotSplited.length > 0 && coldStreamsBotSplited.length > 0) {
        while (hotStreamsBotSplited.length >= coldStreamsBotSplited.length) {
          let { streamOne, streamTwo } = this.streamSplitter(hotStreamsBotSplited[iterator]);
          let index = hotStreamsBotSplited.indexOf(hotStreamsBotSplited[iterator]);
          hotStreamsBotSplited = hotStreamsBotSplited.filter((stream) => stream !== hotStreamsBotSplited[index]);
          hotStreamsBotSplited.push(streamOne);
          hotStreamsBotSplited.push(streamTwo);
          hotStreamsBotSplited = this.streamSortingByCp(hotStreamsBotSplited);

          iterator++;
        }
      }
    }

    hotStreamsTopSplited = this.streamHeatPotential(hotStreamsTopSplited);
    coldStreamsTopSplited = this.streamHeatPotential(coldStreamsTopSplited);
    hotStreamsBotSplited = this.streamHeatPotential(hotStreamsBotSplited);
    coldStreamsBotSplited = this.streamHeatPotential(coldStreamsBotSplited);

    return { hotStreamsTopSplited, coldStreamsTopSplited, hotStreamsBotSplited, coldStreamsBotSplited };
  }

  streamHeatPotential(streams: IRelativePinchStream[]): IRelativePinchStream[] {
    for (let stream of streams) {
      stream.potentialHeat = Math.abs(stream.flowHeatCapacity * (stream.inletTemp - stream.outletTemp));
    }

    return streams;
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

  maxCpPar(hotStreams: IRelativePinchStream[], coldStreams: IRelativePinchStream[]) {
    let hotStream: IRelativePinchStream = {
      parentId: 0,
      inletTemp: 0,
      outletTemp: 0,
      massFlow: 0,
      heatCapacity: 0,
      flowHeatCapacity: 0,
      streamType: "",
      relativePinch: "",
    };
    let coldStream: IRelativePinchStream = {
      parentId: 0,
      inletTemp: 0,
      outletTemp: 0,
      massFlow: 0,
      heatCapacity: 0,
      flowHeatCapacity: 0,
      streamType: "",
      relativePinch: "",
    };

    for (let i = 0; i < hotStreams.length; i++) {
      hotStream.flowHeatCapacity < hotStreams[i].flowHeatCapacity ? (hotStream = hotStreams[i]) : null;
    }

    for (let i = 0; i < coldStreams.length; i++) {
      coldStream.flowHeatCapacity < coldStreams[i].flowHeatCapacity ? (coldStream = coldStreams[i]) : null;
    }

    return { hotStream, coldStream };
  }
}
