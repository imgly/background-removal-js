import {NdArray}  from "ndarray"

export type Imports = {
  createSession: (model: any) => Promise<any>;
  runSession(
    session: any,
    inputs: [string, NdArray<Float32Array>][],
    outputs: [string]
  ): Promise<NdArray<Float32Array>[]>;
};
