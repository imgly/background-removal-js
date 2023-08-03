export type Tensor = {
  shape: number[];
  data: Float32Array;
  dataType: 'float32';
};
export type Imports = {
  createSession: (model: any) => Promise<any>;
  runSession(
    session: any,
    inputs: [string, Tensor][],
    outputs: [string]
  ): Promise<Tensor[]>;
};
