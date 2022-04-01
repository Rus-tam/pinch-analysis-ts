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
      while (hotStreamsTopSplited[iterator].flowHeatCapacity > coldStreamsTopSplited[iterator].flowHeatCapacity) {
        let { streamOne, streamTwo } = this.streamSplitter(hotStreamsTopSplited[iterator]);
        let index = hotStreamsTopSplited.indexOf(hotStreamsTopSplited[iterator]);
        hotStreamsTopSplited = hotStreamsTopSplited.filter((stream) => stream !== hotStreamsTopSplited[index]);
        hotStreamsTopSplited.push(streamOne);
        hotStreamsTopSplited.push(streamTwo);
        hotStreamsTopSplited = this.streamSortingByCp(hotStreamsTopSplited);

        iterator++;
      }
    } else {
      let iterator = 0;
      hotStreamsTopSplited = this.streamSortingByCp(hotStreamsAbove);
      coldStreamsTopSplited = this.streamSortingByCp(coldStreamsAbove);
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

    // Ниже Пинча
    if (hotStreamsBelow.length >= coldStreamsBelow.length) {
      hotStreamsBotSplited = this.streamSortingByCp(hotStreamsBelow);
      coldStreamsBotSplited = this.streamSortingByCp(coldStreamsBelow);

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
    } else {
      let iterator = 0;

      hotStreamsBotSplited = this.streamSortingByCp(hotStreamsBelow);
      coldStreamsBotSplited = this.streamSortingByCp(coldStreamsBelow);

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

  minEntalphy(deltaHhot: number, deltaHcold: number): number {
    let deltaHres: number = 0;
    if (Math.abs(deltaHhot) >= Math.abs(deltaHcold)) {
      deltaHres = Math.abs(deltaHcold);
    } else {
      deltaHres = Math.abs(deltaHhot);
    }

    return deltaHres;
  }

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
          deltaHres = this.minEntalphy(deltaHhot, deltaHcold);

          // Ставим теплообменник
          heatExchBelow.push({
            hotStreamId: hotStreamsBot[i].parentId,
            coldStreamId: coldStreamsBot[i].parentId,
            deltaH: deltaHres,
            inletTempHot: hotStreamsBot[i].outletTemp + deltaHres / hotStreamsBot[i].flowHeatCapacity,
            outletTempHot: hotStreamsBot[i].outletTemp,
            inletTempCold: coldStreamsBot[i].inletTemp,
            outletTempCold: coldStreamsBot[i].inletTemp + deltaHres / coldStreamsBot[i].flowHeatCapacity,
          });

          // Изменяем температуры и тепловые потенциалы потоков
          hotStreamsBot[i].outletTemp = hotStreamsBot[i].outletTemp + deltaHres / hotStreamsBot[i].flowHeatCapacity;
          hotStreamsBot[i].potentialHeat = hotStreamsBot[i].potentialHeat - deltaHres;
          coldStreamsBot[i].inletTemp = coldStreamsBot[i].inletTemp + deltaHres / coldStreamsBot[i].flowHeatCapacity;
          coldStreamsBot[i].potentialHeat = coldStreamsBot[i].potentialHeat - deltaHres;
        }
      }
    }

    console.log(hotStreamsBot);
    console.log(coldStreamsBot);
    console.log("____________________");
    console.log(heatExchBelow);

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
          deltaHres = this.minEntalphy(deltaHhot, deltaHcold);

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

    return { hotStreamsTop, coldStreamsTop, heatExchAbove };
  }
}
