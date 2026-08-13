(() => {
  // node_modules/@litertjs/wasm-utils/dist/index.js
  async function runScript(scriptUrl) {
    if (typeof importScripts === "function") {
      importScripts(scriptUrl.toString());
    } else {
      const script = document.createElement("script");
      script.src = scriptUrl.toString();
      script.crossOrigin = "anonymous";
      return new Promise((resolve, revoke) => {
        script.addEventListener("load", () => {
          resolve();
        }, false);
        script.addEventListener("error", (e) => {
          revoke(e);
        }, false);
        document.body.appendChild(script);
      });
    }
  }
  var createWasmLib = async (constructorFcn, wasmLoaderScript, assetLoaderScript, glCanvas, fileLocator) => {
    if (wasmLoaderScript) {
      await runScript(wasmLoaderScript);
    }
    if (!self.ModuleFactory) {
      throw new Error("ModuleFactory not set.");
    }
    if (assetLoaderScript) {
      await runScript(assetLoaderScript);
      if (!self.ModuleFactory) {
        throw new Error("ModuleFactory not set.");
      }
    }
    if (self.Module && fileLocator) {
      const moduleFileLocator = self.Module;
      moduleFileLocator.locateFile = fileLocator.locateFile;
      if (fileLocator.mainScriptUrlOrBlob) {
        moduleFileLocator.mainScriptUrlOrBlob = fileLocator.mainScriptUrlOrBlob;
      }
    }
    const module = await self.ModuleFactory(self.Module || fileLocator);
    self.ModuleFactory = self.Module = void 0;
    return new constructorFcn(module, glCanvas);
  };

  // node_modules/@litertjs/core/dist/index.js
  var ElementType = {
    NONE: 0,
    FLOAT32: 1,
    INT32: 2,
    UINT8: 3,
    INT64: 4,
    STRING: 5,
    BOOL: 6,
    INT16: 7,
    COMPLEX64: 8,
    INT8: 9,
    FLOAT16: 10,
    FLOAT64: 11,
    COMPLEX128: 12,
    UINT64: 13,
    RESOURCE: 14,
    VARIANT: 15,
    UINT32: 16,
    UINT16: 17,
    INT4: 18,
    BFLOAT16: 19
  };
  var ElementTypeName = {
    [ElementType.NONE]: "NONE",
    [ElementType.FLOAT32]: "FLOAT32",
    [ElementType.INT32]: "INT32",
    [ElementType.UINT8]: "UINT8",
    [ElementType.INT64]: "INT64",
    [ElementType.STRING]: "STRING",
    [ElementType.BOOL]: "BOOL",
    [ElementType.INT16]: "INT16",
    [ElementType.COMPLEX64]: "COMPLEX64",
    [ElementType.INT8]: "INT8",
    [ElementType.FLOAT16]: "FLOAT16",
    [ElementType.FLOAT64]: "FLOAT64",
    [ElementType.COMPLEX128]: "COMPLEX128",
    [ElementType.UINT64]: "UINT64",
    [ElementType.RESOURCE]: "RESOURCE",
    [ElementType.VARIANT]: "VARIANT",
    [ElementType.UINT32]: "UINT32",
    [ElementType.UINT16]: "UINT16",
    [ElementType.INT4]: "INT4",
    [ElementType.BFLOAT16]: "BFLOAT16"
  };
  var TensorBufferType = {
    HOST_MEMORY: 1,
    WEB_GPU_BUFFER: 20,
    WEB_GPU_BUFFER_FP16: 21,
    WEB_GPU_BUFFER_PACKED: 26
  };
  var TensorBufferTypeName = {
    [TensorBufferType.HOST_MEMORY]: "HOST_MEMORY",
    [TensorBufferType.WEB_GPU_BUFFER]: "WEB_GPU_BUFFER",
    [TensorBufferType.WEB_GPU_BUFFER_FP16]: "WEB_GPU_BUFFER_FP16",
    [TensorBufferType.WEB_GPU_BUFFER_PACKED]: "WEB_GPU_BUFFER_PACKED"
  };
  var DATATYPES = Object.freeze([
    {
      dtype: "float32",
      typedArrayConstructor: Float32Array,
      elementType: ElementType.FLOAT32
    },
    {
      dtype: "int32",
      typedArrayConstructor: Int32Array,
      elementType: ElementType.INT32
    },
    {
      dtype: "uint8",
      typedArrayConstructor: Uint8Array,
      elementType: ElementType.UINT8
    }
  ]);
  function getDataType(val) {
    for (const dataTypeMapping of DATATYPES) {
      if (dataTypeMapping.dtype === val || dataTypeMapping.typedArrayConstructor === val || val instanceof dataTypeMapping.typedArrayConstructor || dataTypeMapping.elementType === val) {
        return dataTypeMapping;
      }
    }
    if (typeof val === "string") {
      throw new Error(`DType ${val} is not supported.`);
    } else if (val instanceof Object) {
      throw new Error(`Typed array ${"name" in val ? val.name : val.constructor.name} is not supported.`);
    } else {
      throw new Error(
        `Element type ${ElementTypeName[val] ?? val} is not supported.`
      );
    }
  }
  var LiteRtNotLoadedError = class extends Error {
    constructor() {
      super(
        "LiteRT is not initialized yet. Please call loadLiteRt() and wait for its promise to resolve to load the LiteRT WASM module."
      );
    }
  };
  var globalLiteRt = void 0;
  var globalLiteRtPromise = void 0;
  function getGlobalLiteRt() {
    if (!globalLiteRt) {
      throw new LiteRtNotLoadedError();
    }
    return globalLiteRt;
  }
  function setGlobalLiteRt(liteRt) {
    globalLiteRt = liteRt;
  }
  function getGlobalLiteRtPromise() {
    return globalLiteRtPromise;
  }
  function hasGlobalLiteRtPromise() {
    return Boolean(globalLiteRtPromise);
  }
  function setGlobalLiteRtPromise(promise) {
    globalLiteRtPromise = promise;
  }
  var AcceleratorDefaultTensorBufferType = {
    "webgpu": TensorBufferType.WEB_GPU_BUFFER_PACKED,
    "wasm": TensorBufferType.HOST_MEMORY
  };
  var TensorBufferTypeToAccelerator = {
    [TensorBufferType.HOST_MEMORY]: "wasm",
    [TensorBufferType.WEB_GPU_BUFFER]: "webgpu",
    [TensorBufferType.WEB_GPU_BUFFER_FP16]: "webgpu",
    [TensorBufferType.WEB_GPU_BUFFER_PACKED]: "webgpu"
  };
  var DESIRED_WEBGPU_FEATURES = [
    "shader-f16",
    "subgroups"
  ];
  var Environment = class _Environment {
    constructor(options) {
      this.options = options;
      this.liteRtEnvironment = getGlobalLiteRt().liteRtWasm.LiteRtEnvironment.create(
        options.webGpuDevice
      );
    }
    liteRtEnvironment;
    static async create(options = {}) {
      let webGpuDevice = null;
      if ("webGpuDevice" in options) {
        if (options.webGpuDevice) {
          webGpuDevice = options.webGpuDevice;
        }
      } else {
        try {
          webGpuDevice = await createDefaultWebGpuDevice();
        } catch (e) {
          console.warn("Failed to create default WebGPU device:", e);
        }
      }
      return new _Environment({
        ...options,
        webGpuDevice
      });
    }
    get webGpuDevice() {
      return this.options.webGpuDevice;
    }
    delete() {
      this.liteRtEnvironment.delete();
    }
  };
  async function createDefaultWebGpuDevice() {
    const adapterDescriptor = {
      powerPreference: "high-performance"
    };
    const adapter = await navigator.gpu.requestAdapter(adapterDescriptor);
    if (!adapter) {
      throw new Error("No GPU adapter found.");
    }
    const requiredLimits = {
      maxBufferSize: adapter.limits.maxBufferSize,
      maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
      maxStorageBuffersPerShaderStage: adapter.limits.maxStorageBuffersPerShaderStage,
      maxTextureDimension2D: adapter.limits.maxTextureDimension2D
    };
    const requiredFeatures = [];
    for (const feature of DESIRED_WEBGPU_FEATURES) {
      if (adapter.features.has(feature)) {
        requiredFeatures.push(feature);
      }
    }
    return await adapter.requestDevice({
      requiredFeatures,
      requiredLimits
    });
  }
  function emscriptenVectorToArray(vector) {
    const array = new Array(vector.size());
    for (let i = 0; i < vector.size(); ++i) {
      array[i] = vector.get(i);
    }
    vector.delete();
    return array;
  }
  function fillEmscriptenVector(data, vector) {
    for (const item of data) {
      vector.push_back(item);
    }
  }
  function parseData(remainingArgs) {
    const data = remainingArgs.shift();
    const liteRtWasm = getGlobalLiteRt().liteRtWasm;
    if (data instanceof liteRtWasm.LiteRtTensorBuffer) {
      return { liteRtTensorBuffer: data };
    } else if (ArrayBuffer.isView(data)) {
      return { typedArray: data };
    } else if (data instanceof GPUBuffer) {
      return { gpuBuffer: data };
    } else {
      throw new Error(
        `Unknown type (${data?.constructor.name ?? data}) provided to create a Tensor`
      );
    }
  }
  function parseShape(remainingArgs) {
    if (Array.isArray(remainingArgs[0]) || remainingArgs[0] instanceof Int32Array) {
      return { shape: remainingArgs.shift() };
    } else {
      return {};
    }
  }
  function shiftUntilDefined(remainingArgs) {
    while (remainingArgs.length > 0 && remainingArgs[0] === void 0) {
      remainingArgs.shift();
    }
  }
  function parseDataType(remainingArgs) {
    shiftUntilDefined(remainingArgs);
    if (typeof remainingArgs[0] === "string") {
      const dtype = remainingArgs.shift();
      return { dataType: getDataType(dtype).dtype };
    } else {
      return {};
    }
  }
  function parseEnvironment(remainingArgs) {
    shiftUntilDefined(remainingArgs);
    if (remainingArgs[0] instanceof Environment) {
      return { environment: remainingArgs.shift() };
    } else {
      return {};
    }
  }
  function parseOnDelete(remainingArgs) {
    shiftUntilDefined(remainingArgs);
    if (remainingArgs[0] instanceof Function) {
      return { onDelete: remainingArgs.shift() };
    } else {
      return {};
    }
  }
  function parseArgs(args) {
    return {
      ...parseData(args),
      ...parseShape(args),
      ...parseDataType(args),
      ...parseEnvironment(args),
      ...parseOnDelete(args)
    };
  }
  var Tensor = class _Tensor {
    liteRtTensorBuffer;
    type;
    environment;
    deletedInternal = false;
    onDelete;
    static copyFunctions = /* @__PURE__ */ new Map();
    constructor(a, b, c, d, e) {
      const {
        typedArray,
        gpuBuffer,
        liteRtTensorBuffer,
        shape,
        dataType,
        environment,
        onDelete
      } = parseArgs([a, b, c, d, e]);
      this.onDelete = onDelete;
      this.environment = environment ?? getGlobalLiteRt().getDefaultEnvironment();
      if (liteRtTensorBuffer) {
        if (shape) {
          throw new Error(
            "A LiteRtTensorBuffer cannot be provided with a shape."
          );
        }
        if (dataType) {
          throw new Error(
            "A LiteRtTensorBuffer cannot be provided with a data type."
          );
        }
        this.liteRtTensorBuffer = liteRtTensorBuffer;
      } else if (gpuBuffer) {
        if (!shape) {
          throw new Error("A GPUBuffer must be provided with a shape.");
        }
        if (!dataType) {
          throw new Error("A GPUBuffer must be provided with a data type.");
        }
        const [liteRtTensorBuffer2, webGpuBufferPtr] = webGpuBufferToLiteRtTensorBuffer(
          gpuBuffer,
          shape,
          dataType,
          this.environment
        );
        this.liteRtTensorBuffer = liteRtTensorBuffer2;
        const onDelete2 = this.onDelete;
        this.onDelete = () => {
          const liteRtWasm = getGlobalLiteRt().liteRtWasm;
          liteRtWasm.wgpuBufferRelease(webGpuBufferPtr);
          onDelete2?.();
        };
      } else if (typedArray) {
        this.liteRtTensorBuffer = typedArrayToLiteRtTensorBuffer(
          typedArray,
          shape,
          environment
        );
      } else {
        throw new Error("No data provided to create a Tensor.");
      }
      this.type = liteRtTensorBufferToTensorType(this.liteRtTensorBuffer);
    }
    static fromTypedArray(data, shape, environment) {
      return new _Tensor(data, shape, environment);
    }
    ensureNotDeleted() {
      if (this.deleted) {
        throw new Error("Tensor is deleted and cannot be used.");
      }
    }
    async data() {
      this.ensureNotDeleted();
      if (this.liteRtTensorBuffer.bufferType().value === TensorBufferType.HOST_MEMORY) {
        return this.toTypedArray();
      }
      const copy = await this.copyTo("wasm");
      const data = await copy.data();
      copy.delete();
      return data;
    }
    toTypedArray() {
      this.ensureNotDeleted();
      const liteRtWasm = getGlobalLiteRt().liteRtWasm;
      if (this.liteRtTensorBuffer.isWebGpuMemory()) {
        throw new Error(
          "Cannot convert a Tensor with WebGPU memory to a TypedArray."
        );
      }
      if (this.liteRtTensorBuffer.bufferType().value !== liteRtWasm.LiteRtTensorBufferType.HOST_MEMORY.value) {
        throw new Error(
          "Cannot convert a Tensor with non-host memory to a TypedArray."
        );
      }
      if (this.liteRtTensorBuffer.size() !== this.liteRtTensorBuffer.packedSize() || this.liteRtTensorBuffer.offset() !== 0) {
        throw new Error("Tensors with strides or padding are not yet supported.");
      }
      const rankedTensorType = this.liteRtTensorBuffer.tensorType();
      const elementType = rankedTensorType.elementType();
      const byteWidth = liteRtWasm.liteRtGetByteWidth(elementType);
      rankedTensorType.delete();
      const typedArrayConstructor = getDataType(
        elementType.value
      ).typedArrayConstructor;
      if (typedArrayConstructor.BYTES_PER_ELEMENT !== byteWidth) {
        throw new Error(
          `Byte width ${byteWidth} of the tensor's element type ${ElementTypeName[elementType.value]} does not match the expected byte width ${typedArrayConstructor.BYTES_PER_ELEMENT} of the ${typedArrayConstructor.name}.`
        );
      }
      const dataPtr = this.liteRtTensorBuffer.lock(
        getGlobalLiteRt().liteRtWasm.LiteRtTensorBufferLockMode.READ
      );
      try {
        const uint8Array = liteRtWasm.HEAPU8.slice(
          dataPtr,
          dataPtr + this.liteRtTensorBuffer.packedSize()
        );
        const typedArray = new typedArrayConstructor(
          uint8Array.buffer,
          uint8Array.byteOffset,
          uint8Array.byteLength / byteWidth
        );
        return typedArray;
      } finally {
        this.liteRtTensorBuffer.unlock();
      }
    }
    getBufferType() {
      this.ensureNotDeleted();
      return this.liteRtTensorBuffer.bufferType().value;
    }
    /**
     * Returns the underlying GPUBuffer of the Tensor.
     *
     * Note that the lifetime of the returned GPUBuffer is dependant upon how the
     * Tensor was created. If the Tensor was constructed from a GPUBuffer, then
     * the GPUBuffer will NOT be released when the Tensor is deleted. If the
     * Tensor was copied/moved to GPU from host memory, then the GPU buffer will
     * be released when the Tensor is deleted.
     *
     * The GPU buffer may be larger than the actual data in the tensor.
     *
     * @return The GPUBuffer containing the Tensor's data.
     */
    toGpuBuffer() {
      this.ensureNotDeleted();
      const liteRtWasm = getGlobalLiteRt().liteRtWasm;
      if (!this.liteRtTensorBuffer.isWebGpuMemory()) {
        throw new Error(
          "Cannot convert a Tensor with non-WebGPU memory to a GPUBuffer."
        );
      }
      const bufferTypeValue = this.liteRtTensorBuffer.bufferType().value;
      if (bufferTypeValue !== liteRtWasm.LiteRtTensorBufferType.WEB_GPU_BUFFER.value && bufferTypeValue !== liteRtWasm.LiteRtTensorBufferType.WEB_GPU_BUFFER_FP16.value && bufferTypeValue !== liteRtWasm.LiteRtTensorBufferType.WEB_GPU_BUFFER_PACKED.value) {
        throw new Error(
          "Cannot convert a Tensor with host memory to a GPUBuffer."
        );
      }
      if (this.liteRtTensorBuffer.size() !== this.liteRtTensorBuffer.packedSize() || this.liteRtTensorBuffer.offset() !== 0) {
        throw new Error("Tensors with strides or padding are not yet supported.");
      }
      const gpuBufferId = this.liteRtTensorBuffer.getWebGpuBuffer();
      return liteRtWasm.WebGPU.getJsObject(gpuBufferId);
    }
    getCopyFunctionSet(destination) {
      this.ensureNotDeleted();
      const sourceBufferType = this.getBufferType();
      const copyFunctions = _Tensor.copyFunctions.get(sourceBufferType);
      if (!copyFunctions) {
        throw new Error(
          `TensorBufferType ${TensorBufferTypeName[sourceBufferType] ?? sourceBufferType} does not support copying or moving`
        );
      }
      const destinationBufferType = typeof destination === "string" ? AcceleratorDefaultTensorBufferType[destination] : destination;
      if (destinationBufferType == null) {
        throw new Error(
          `Unknown destination '${destination}' for copying or moving.`
        );
      }
      const copyFunctionSet = copyFunctions.get(destinationBufferType);
      if (!copyFunctionSet) {
        const supportedDestinations = [...copyFunctions].map(
          ([key]) => TensorBufferTypeName[key] ?? key
        );
        throw new Error(
          `TensorBufferType ${TensorBufferTypeName[sourceBufferType]} does not support copying or moving to ${TensorBufferTypeName[destinationBufferType]}. It supports the following TensorBufferTypes: [${supportedDestinations.join(
            ", "
          )}].`
        );
      }
      return [copyFunctionSet, destinationBufferType];
    }
    /**
     * Copies the tensor to the given accelerator.
     *
     * @param destination The accelerator or buffer type to copy to.
     * @return A promise that resolves to the copied tensor.
     */
    async copyTo(destination, options) {
      const [copyFunctionSet, destinationBufferType] = this.getCopyFunctionSet(destination);
      if (!copyFunctionSet.copyTo) {
        throw new Error(
          `Copying to ${TensorBufferTypeName[destinationBufferType]} is not supported by this tensor.`
        );
      }
      return copyFunctionSet.copyTo(this, options);
    }
    /**
     * Moves the tensor to the given accelerator.
     *
     * @param destination The accelerator or buffer type to move to.
     * @return A promise that resolves to the moved tensor.
     */
    async moveTo(destination, options) {
      const [copyFunctionSet, destinationBufferType] = this.getCopyFunctionSet(destination);
      if (!copyFunctionSet.moveTo) {
        throw new Error(
          `Moving to ${TensorBufferTypeName[destinationBufferType]} is not supported by this tensor.`
        );
      }
      return copyFunctionSet.moveTo(this, options);
    }
    get bufferType() {
      return this.liteRtTensorBuffer.bufferType().value;
    }
    get accelerator() {
      const accelerator = TensorBufferTypeToAccelerator[this.bufferType];
      if (accelerator === void 0) {
        throw new Error(
          `TensorBufferType ${TensorBufferTypeName[this.bufferType]} has an unknown accelerator type.`
        );
      }
      return accelerator;
    }
    get deleted() {
      return this.deletedInternal;
    }
    delete() {
      if (this.deletedInternal) {
        return;
      }
      this.deletedInternal = true;
      this.liteRtTensorBuffer.delete();
      this.onDelete?.();
    }
  };
  function liteRtTensorBufferToTensorType(liteRtTensorBuffer) {
    const liteRtRankedTensorType = liteRtTensorBuffer.tensorType();
    const elementType = liteRtRankedTensorType.elementType();
    const liteRtLayout = liteRtRankedTensorType.layout();
    const dimensions = liteRtLayout.dimensions();
    liteRtLayout.delete();
    liteRtRankedTensorType.delete();
    return {
      dtype: getDataType(elementType.value).dtype,
      layout: { dimensions: emscriptenVectorToArray(dimensions) }
    };
  }
  function webGpuBufferToLiteRtTensorBuffer(gpuBuffer, shape, dtype, environment) {
    const globalLiteRt2 = getGlobalLiteRt();
    const liteRtWasm = globalLiteRt2.liteRtWasm;
    const dimensionsVector = new liteRtWasm.VectorInt32();
    fillEmscriptenVector(shape, dimensionsVector);
    const layout = liteRtWasm.LiteRtLayout.create(dimensionsVector);
    dimensionsVector.delete();
    const rankedTensorType = liteRtWasm.LiteRtRankedTensorType.create(
      { value: getDataType(dtype).elementType },
      layout
    );
    layout.delete();
    const importedGpuBufferPtr = liteRtWasm.WebGPU.importJsBuffer(gpuBuffer);
    const liteRtTensorBuffer = liteRtWasm.LiteRtTensorBuffer.createFromWebGpuBuffer(
      environment.liteRtEnvironment,
      rankedTensorType,
      liteRtWasm.LiteRtTensorBufferType.WEB_GPU_BUFFER_PACKED,
      importedGpuBufferPtr,
      gpuBuffer.size
    );
    rankedTensorType.delete();
    return [liteRtTensorBuffer, importedGpuBufferPtr];
  }
  function typedArrayToLiteRtTensorBuffer(data, shape, environment) {
    const globalLiteRt2 = getGlobalLiteRt();
    const liteRtWasm = globalLiteRt2.liteRtWasm;
    environment = environment ?? globalLiteRt2.getDefaultEnvironment();
    const elementType = getDataType(data).elementType;
    const dimensionsVector = new liteRtWasm.VectorInt32();
    fillEmscriptenVector(shape ?? [data.length], dimensionsVector);
    const layout = liteRtWasm.LiteRtLayout.create(dimensionsVector);
    dimensionsVector.delete();
    const expectedNumElements = layout.numElements();
    if (data.length !== expectedNumElements) {
      layout.delete();
      throw new Error(
        `Number of elements ${data.length} of the provided TypedArray does not match the expected number of elements ${expectedNumElements}.`
      );
    }
    const rankedTensorType = liteRtWasm.LiteRtRankedTensorType.create(
      { value: elementType },
      layout
    );
    layout.delete();
    const arrayType = data.constructor;
    const bufferSize = arrayType.BYTES_PER_ELEMENT * data.length;
    const expectedBufferSize = rankedTensorType.bytes();
    if (bufferSize !== expectedBufferSize) {
      rankedTensorType.delete();
      throw new Error(
        `Byte length ${bufferSize} of the provided TypedArray does not match the expected buffer size ${expectedBufferSize}.`
      );
    }
    const liteRtTensorBuffer = liteRtWasm.LiteRtTensorBuffer.createManaged(
      environment.liteRtEnvironment,
      liteRtWasm.LiteRtTensorBufferType.HOST_MEMORY,
      rankedTensorType,
      bufferSize
    );
    rankedTensorType.delete();
    const dataPtr = liteRtTensorBuffer.lock(
      liteRtWasm.LiteRtTensorBufferLockMode.WRITE
    );
    try {
      const uint8Data = new Uint8Array(
        data.buffer,
        data.byteOffset,
        data.byteLength
      );
      liteRtWasm.HEAPU8.set(uint8Data, dataPtr);
    } finally {
      liteRtTensorBuffer.unlock();
    }
    return liteRtTensorBuffer;
  }
  var CompiledModelSignatureRunner = class {
    constructor(signatureIndex, liteRtModel, liteRtCompiledModel, options) {
      this.signatureIndex = signatureIndex;
      this.liteRtModel = liteRtModel;
      this.liteRtCompiledModel = liteRtCompiledModel;
      this.options = options;
      this.liteRtSimpleSignature = liteRtModel.getSignature(signatureIndex);
      const inputNames = emscriptenVectorToArray(this.liteRtSimpleSignature.inputNames());
      const inputDetails = [];
      for (let i = 0; i < inputNames.length; i++) {
        const name = inputNames[i];
        const tensorType = liteRtModel.getInputTensorType(signatureIndex, i);
        const requirements = liteRtCompiledModel.getInputBufferRequirements(signatureIndex, i);
        inputDetails.push(makeTensorDetails(name, i, tensorType, requirements));
      }
      this.inputDetails = Object.freeze(inputDetails);
      const outputNames = emscriptenVectorToArray(this.liteRtSimpleSignature.outputNames());
      const outputDetails = [];
      for (let i = 0; i < outputNames.length; i++) {
        const name = outputNames[i];
        const tensorType = liteRtModel.getOutputTensorType(signatureIndex, i);
        const requirements = liteRtCompiledModel.getOutputBufferRequirements(signatureIndex, i);
        outputDetails.push(makeTensorDetails(name, i, tensorType, requirements));
      }
      this.outputDetails = Object.freeze(outputDetails);
    }
    inputDetails;
    outputDetails;
    liteRtSimpleSignature;
    deletedInternal = false;
    /**
     * The string key corresponding to this signature in the model.
     */
    get key() {
      this.ensureNotDeleted();
      return this.liteRtSimpleSignature.key();
    }
    /**
     * Get details about each input tensor.
     */
    getInputDetails() {
      this.ensureNotDeleted();
      return this.inputDetails;
    }
    /**
     * Get details about each output tensor.
     */
    getOutputDetails() {
      this.ensureNotDeleted();
      return this.outputDetails;
    }
    async run(input) {
      this.ensureNotDeleted();
      const inputArray = this.inputsToArray(input);
      const { inputsOnAccelerator, cleanup } = await this.ensureInputsOnAccelerator(inputArray);
      let outputArray;
      try {
        outputArray = await this.runWithArray(inputsOnAccelerator);
      } finally {
        cleanup();
      }
      if (Array.isArray(input) || input instanceof Tensor) {
        return outputArray;
      } else {
        return this.outputsToRecord(outputArray);
      }
    }
    inputsToArray(input) {
      if (Array.isArray(input)) {
        if (input.length !== this.inputDetails.length) {
          throw new Error(
            `run() called with ${input.length} inputs, but signature expects ${this.inputDetails.length} inputs`
          );
        }
        return input;
      }
      if (input instanceof Tensor) {
        if (this.inputDetails.length !== 1) {
          throw new Error(
            `run() called with a single tensor, but signature expects ${this.inputDetails.length} inputs`
          );
        }
        return [input];
      }
      const inputArray = [];
      for (const inputDetails of this.inputDetails) {
        if (!(inputDetails.name in input)) {
          throw new Error(
            `run() called with input record that is missing input ${inputDetails.name} with index ${inputDetails.index}`
          );
        }
        inputArray.push(input[inputDetails.name]);
      }
      return inputArray;
    }
    outputsToRecord(output) {
      const outputRecord = {};
      for (let i = 0; i < this.outputDetails.length; i++) {
        outputRecord[this.outputDetails[i].name] = output[i];
      }
      return outputRecord;
    }
    /**
     * Ensures that all input tensors are on the correct accelerator. Copies any
     * tensors that are not on the correct accelerator.
     *
     * @param inputs The input tensors to be passed to the signature. They must
     *     be in the same order and quantity as the input details.
     * @return A promise that resolves to a list of input tensors that are on the
     *     correct accelerator, and a cleanup function that deletes any tensors
     *     that were copied.
     */
    async ensureInputsOnAccelerator(inputs) {
      const toDelete = [];
      const inputsOnAccelerator = [];
      const inputDetails = this.getInputDetails();
      if (inputs.length !== inputDetails.length) {
        throw new Error(`ensureInputsOnAccelerator() called with ${inputs.length} inputs, but signature expects ${inputDetails.length} inputs`);
      }
      for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i];
        const bufferType = input.getBufferType();
        const supportedBufferTypes = inputDetails[i].supportedBufferTypes;
        if (supportedBufferTypes.size === 0) {
          throw new Error(`Tensor ${inputDetails[i].name} with index ${inputDetails[i].index} has no supported buffer types.`);
        }
        if (supportedBufferTypes.has(bufferType)) {
          inputsOnAccelerator.push(input);
        } else {
          const newBufferType = supportedBufferTypes.values().next().value;
          const copy = await input.copyTo(newBufferType);
          toDelete.push(copy);
          inputsOnAccelerator.push(copy);
        }
      }
      return {
        inputsOnAccelerator,
        cleanup: () => {
          for (const tensor of toDelete) {
            tensor.delete();
          }
        }
      };
    }
    async runWithArray(input) {
      for (let i = 0; i < input.length; i++) {
        const inputTensor = input[i];
        const expectedRankedTensorType = this.liteRtModel.getInputTensorType(this.signatureIndex, i);
        const inputRequirements = this.liteRtCompiledModel.getInputBufferRequirements(
          this.signatureIndex,
          i
        );
        getGlobalLiteRt().liteRtWasm.checkTensorBufferCompatible(
          inputTensor.liteRtTensorBuffer,
          expectedRankedTensorType,
          inputRequirements
        );
        expectedRankedTensorType.delete();
        inputRequirements.delete();
      }
      const outputTensorBuffers = await this.liteRtCompiledModel.run(
        this.signatureIndex,
        input.map((tensor) => tensor.liteRtTensorBuffer)
      );
      return outputTensorBuffers.map(
        (tensorBuffer) => new Tensor(tensorBuffer, this.options.environment)
      );
    }
    get deleted() {
      return this.deletedInternal;
    }
    ensureNotDeleted() {
      if (this.deleted) {
        throw new Error(
          "CompiledModelSignatureRunner is deleted and cannot be used."
        );
      }
    }
    delete() {
      if (this.deletedInternal) {
        return;
      }
      this.deletedInternal = true;
      this.liteRtSimpleSignature.delete();
    }
  };
  function makeTensorDetails(name, index, tensorType, requirements) {
    const layout = tensorType.layout();
    const dimensions = emscriptenVectorToArray(layout.dimensions());
    layout.delete();
    const supportedBufferTypes = new Set(emscriptenVectorToArray(requirements.supportedTypes()).map(({ value }) => value));
    const details = {
      name,
      index,
      dtype: getDataType(tensorType.elementType().value).dtype,
      shape: new Int32Array(dimensions),
      supportedBufferTypes
    };
    tensorType.delete();
    requirements.delete();
    return details;
  }
  var CompiledModel = class {
    constructor(model, liteRtCompiledModel, options, onDelete) {
      this.model = model;
      this.liteRtCompiledModel = liteRtCompiledModel;
      this.options = options;
      this.onDelete = onDelete;
      const numSignatures = model.liteRtModel.getNumSignatures();
      const compiledModelSignatureRunners = {};
      for (let i = 0; i < numSignatures; i++) {
        const compiledModelSignatureRunner = new CompiledModelSignatureRunner(
          i,
          model.liteRtModel,
          liteRtCompiledModel,
          options
        );
        compiledModelSignatureRunners[compiledModelSignatureRunner.key] = compiledModelSignatureRunner;
      }
      this.compiledModelSignatureRunners = Object.freeze(compiledModelSignatureRunners);
      this.defaultSignature = Object.values(this.signatures)[0];
      this.key = this.defaultSignature.key;
    }
    defaultSignature;
    compiledModelSignatureRunners;
    key;
    deletedInternal = false;
    get signatures() {
      this.ensureNotDeleted();
      return this.compiledModelSignatureRunners;
    }
    getInputDetails() {
      this.ensureNotDeleted();
      return this.defaultSignature.getInputDetails();
    }
    getOutputDetails() {
      this.ensureNotDeleted();
      return this.defaultSignature.getOutputDetails();
    }
    async run(inputOrSignatureName, maybeInput) {
      this.ensureNotDeleted();
      const [signature, input] = this.parseRunInputs(inputOrSignatureName, maybeInput);
      return await signature.run(input);
    }
    parseRunInputs(inputOrSignatureName, maybeInput) {
      let signature;
      let input;
      if (typeof inputOrSignatureName === "string") {
        signature = this.signatures[inputOrSignatureName];
        if (!signature) {
          throw new Error(
            `No signature named ${inputOrSignatureName} found in model.`
          );
        }
        if (!maybeInput) {
          throw new Error(
            `No input provided for signature ${inputOrSignatureName}`
          );
        }
        input = maybeInput;
      } else {
        signature = this.defaultSignature;
        input = inputOrSignatureName;
      }
      return [signature, input];
    }
    get deleted() {
      return this.deletedInternal;
    }
    ensureNotDeleted() {
      if (this.deleted) {
        throw new Error("CompiledModel is deleted and cannot be used.");
      }
    }
    get isFullyAccelerated() {
      this.ensureNotDeleted();
      return this.liteRtCompiledModel.isFullyAccelerated();
    }
    delete() {
      if (this.deletedInternal) {
        return;
      }
      this.deletedInternal = true;
      this.liteRtCompiledModel.delete();
      this.model.delete();
      for (const signatureRunner of Object.values(
        this.compiledModelSignatureRunners
      )) {
        signatureRunner.delete();
      }
      this.onDelete();
    }
  };
  async function urlToUint8Array(url) {
    const response = await fetch(url);
    return new Uint8Array(await response.arrayBuffer());
  }
  async function readableStreamDefaultReaderToUint8Array(reader) {
    let byteOffset = 0;
    let array = new Uint8Array(
      1024
      /* arbitrary starting size */
    );
    const MAX_ARRAY_SIZE = 2e9;
    while (true) {
      const { done, value } = await reader.read();
      if (value) {
        if (array.byteLength < byteOffset + value.byteLength) {
          if (byteOffset + value.byteLength > MAX_ARRAY_SIZE) {
            throw new Error(`Model is too large (> ${MAX_ARRAY_SIZE} bytes).`);
          }
          const newArray = new Uint8Array(Math.min(
            MAX_ARRAY_SIZE,
            Math.max(array.byteLength, value.byteLength) * 2
          ));
          newArray.set(array);
          array = newArray;
        }
        array.set(value, byteOffset);
        byteOffset += value.byteLength;
      }
      if (done) {
        break;
      }
    }
    return array.slice(0, byteOffset);
  }
  var Model = class {
    constructor(liteRtModel, onDelete) {
      this.liteRtModel = liteRtModel;
      this.onDelete = onDelete;
    }
    delete() {
      this.liteRtModel.delete();
      this.onDelete();
    }
  };
  function fillCompileOptions(compileOptions = {}, environment, defaultThreadCount) {
    return {
      environment,
      accelerator: compileOptions.accelerator ?? (environment.webGpuDevice ? "webgpu" : "wasm"),
      cpuOptions: compileOptions.cpuOptions ?? { numThreads: defaultThreadCount },
      gpuOptions: compileOptions.gpuOptions ?? {},
      webNNOptions: compileOptions.webNNOptions ?? {}
    };
  }
  var WASM_RELAXED_SIMD_CHECK = new Uint8Array([
    0,
    97,
    115,
    109,
    1,
    0,
    0,
    0,
    1,
    5,
    1,
    96,
    0,
    1,
    123,
    3,
    2,
    1,
    0,
    10,
    15,
    1,
    13,
    0,
    65,
    1,
    253,
    15,
    65,
    2,
    253,
    15,
    253,
    128,
    2,
    11
  ]);
  var WASM_THREADS_CHECK = new Uint8Array([
    0,
    97,
    115,
    109,
    1,
    0,
    0,
    0,
    1,
    4,
    1,
    96,
    0,
    0,
    3,
    2,
    1,
    0,
    5,
    4,
    1,
    3,
    1,
    1,
    10,
    11,
    1,
    9,
    0,
    65,
    0,
    254,
    16,
    2,
    0,
    26,
    11
  ]);
  var WASM_FEATURE_VALUES = {
    "relaxedSimd": void 0,
    "threads": void 0,
    "jspi": void 0,
    "webnn": void 0
  };
  function isJspiSupported() {
    return "Suspending" in WebAssembly;
  }
  function isWebNnSupported() {
    return typeof navigator !== "undefined" && !!navigator.ml;
  }
  async function tryWasm(wasm) {
    try {
      await WebAssembly.instantiate(wasm);
      return { supported: true };
    } catch (e) {
      return { supported: false, error: e };
    }
  }
  var WASM_FEATURE_CHECKS = {
    "relaxedSimd": () => {
      if (WASM_FEATURE_VALUES.relaxedSimd === void 0) {
        WASM_FEATURE_VALUES.relaxedSimd = tryWasm(WASM_RELAXED_SIMD_CHECK);
      }
      return WASM_FEATURE_VALUES.relaxedSimd;
    },
    "threads": () => {
      if (WASM_FEATURE_VALUES.threads === void 0) {
        try {
          if (typeof MessageChannel !== "undefined") {
            new MessageChannel().port1.postMessage(new SharedArrayBuffer(1));
          }
          WASM_FEATURE_VALUES.threads = tryWasm(WASM_THREADS_CHECK);
        } catch (e) {
          WASM_FEATURE_VALUES.threads = Promise.resolve({ supported: false, error: e });
        }
      }
      return WASM_FEATURE_VALUES.threads;
    },
    "jspi": () => {
      if (WASM_FEATURE_VALUES.jspi === void 0) {
        const supported = isJspiSupported();
        WASM_FEATURE_VALUES.jspi = Promise.resolve({
          supported,
          error: supported ? void 0 : new Error("JSPI is not supported")
        });
      }
      return WASM_FEATURE_VALUES.jspi;
    },
    "webnn": () => {
      if (WASM_FEATURE_VALUES.webnn === void 0) {
        const supported = isWebNnSupported();
        WASM_FEATURE_VALUES.webnn = Promise.resolve({
          supported,
          error: supported ? void 0 : new Error("WebNN is not supported")
        });
      }
      return WASM_FEATURE_VALUES.webnn;
    }
  };
  async function supportsFeature(feature) {
    const check = WASM_FEATURE_CHECKS[feature]?.();
    if (!check) {
      throw new Error(`Unknown feature: ${feature}`);
    }
    return (await check).supported;
  }
  async function throwIfFeatureNotSupported(feature) {
    const check = WASM_FEATURE_CHECKS[feature]?.();
    if (!check) {
      throw new Error(`Unknown feature: ${feature}`);
    }
    const result = await check;
    if (!result.supported) {
      throw result.error;
    }
  }
  function isWebGPUSupported() {
    return !!(typeof globalThis !== "undefined" && globalThis.navigator && globalThis.navigator.gpu);
  }
  function loadAndCompile(model, compileOptions) {
    return getGlobalLiteRt().loadAndCompile(model, compileOptions);
  }
  var LiteRt = class {
    liteRtWasm;
    defaultEnvironment;
    objectsToDelete = /* @__PURE__ */ new Set();
    constructor(wasmModule) {
      this.liteRtWasm = wasmModule;
      this.liteRtWasm.setupLogging();
    }
    setDefaultEnvironment(environment) {
      this.defaultEnvironment = environment;
    }
    getDefaultEnvironment() {
      if (!this.defaultEnvironment) {
        throw new Error("Default environment is not set.");
      }
      return this.defaultEnvironment;
    }
    setWebGpuDevice(device) {
      const oldEnvironment = this.getDefaultEnvironment();
      this.setDefaultEnvironment(new Environment({
        ...oldEnvironment.options,
        webGpuDevice: device
      }));
    }
    getWebGpuDevice() {
      return this.getDefaultEnvironment().webGpuDevice;
    }
    /**
     * Registers an object to be deleted when this LiteRt instance is deleted.
     * Internal use only.
     */
    _registerObjectForDeletion(object) {
      this.objectsToDelete.add(object);
    }
    /**
     * Unregisters an object from being deleted when this LiteRt instance is
     * deleted. Internal use only.
     */
    _unregisterObjectForDeletion(object) {
      this.objectsToDelete.delete(object);
    }
    /**
     * Loads and compiles a LiteRt model.
     *
     * @param model The model data. This can be a string (the model url), a URL
     *     object, a Uint8Array (the model bytes), or a
     *     ReadableStreamDefaultReader (for streaming model loading).
     * @param compileOptions The options for compiling the model. This includes
     *     the accelerator to use ('webgpu' or 'wasm') and the WebGPU device
     *     (for direct GPU model inputs / outputs).
     * @returns A promise that resolves to the CompiledModel.
     */
    async loadAndCompile(model, compileOptions = {}) {
      let modelData;
      if (typeof model === "string" || model instanceof URL) {
        modelData = await urlToUint8Array(model);
      } else if (model instanceof Uint8Array) {
        modelData = model;
      } else if (model instanceof ReadableStreamDefaultReader) {
        modelData = await readableStreamDefaultReaderToUint8Array(model);
      } else {
        throw new Error("Unsupported model type.");
      }
      const environment = compileOptions.environment ?? this.getDefaultEnvironment();
      const accelerator = compileOptions.accelerator ?? (environment.webGpuDevice ? "webgpu" : "wasm");
      const isWebGpu = accelerator === "webgpu";
      if (isWebGpu && !environment.webGpuDevice) {
        throw new Error(
          "WebGPU was requested but no WebGPU device is set in the environment."
        );
      }
      const filledCompileOptions = fillCompileOptions(
        compileOptions,
        environment,
        this.liteRtWasm.getThreadCount()
      );
      const ptr = this.liteRtWasm._malloc(modelData.byteLength);
      this.liteRtWasm.HEAPU8.set(modelData, ptr);
      const wasmModel = this.liteRtWasm.loadModel(
        filledCompileOptions.environment.liteRtEnvironment,
        ptr,
        modelData.byteLength
      );
      const wasmCompiledModel = await this.liteRtWasm.compileModel(
        filledCompileOptions.environment.liteRtEnvironment,
        wasmModel,
        filledCompileOptions
      );
      const loadedModel = new Model(wasmModel, () => {
        this.liteRtWasm._free(ptr);
      });
      const compiledModel = new CompiledModel(
        loadedModel,
        wasmCompiledModel,
        filledCompileOptions,
        () => {
          this.objectsToDelete.delete(compiledModel);
        }
      );
      this.objectsToDelete.add(compiledModel);
      const isWebNn = accelerator === "webnn";
      const acceleratorRequested = isWebGpu || isWebNn;
      if (acceleratorRequested && !compiledModel.isFullyAccelerated) {
        if (isJspiSupported()) {
          console.warn(
            `%c[LiteRT]%c Model not fully compiled for ${accelerator}. Partially delegating to WASM execution.`,
            "background: #FFA000; color: black; font-weight: bold; padding: 2px 5px; border-radius: 3px;",
            "font-weight: bold;"
          );
        } else {
          console.warn(
            `%c[LiteRT]%c Model not fully compiled for ${accelerator} on non-JSPI browser. Falling back to WASM execution.`,
            "background: #D32F2F; color: white; font-weight: bold; padding: 2px 5px; border-radius: 3px;",
            "color: #D32F2F; font-weight: bold;"
          );
          compiledModel.delete();
          const fallbackCompileOptions = {
            ...compileOptions,
            accelerator: "wasm"
          };
          return this.loadAndCompile(modelData, fallbackCompileOptions);
        }
      }
      return compiledModel;
    }
    delete() {
      for (const object of this.objectsToDelete) {
        object.delete();
      }
    }
  };
  function pathToString(path) {
    return path;
  }
  function appendPathSegment(path, segment) {
    if (!path) return segment;
    if (!segment) return path;
    const pathWithSlash = path.endsWith("/") ? path : path + "/";
    const segmentWithoutSlash = segment.startsWith("/") ? segment.substring(1) : segment;
    return pathWithSlash + segmentWithoutSlash;
  }
  var WASM_JS_FILE_NAME = "litert_wasm_internal.js";
  var WASM_JS_COMPAT_FILE_NAME = "litert_wasm_compat_internal.js";
  var WASM_JS_THREADED_FILE_NAME = "litert_wasm_threaded_internal.js";
  var WASM_JS_JSPI_FILE_NAME = "litert_wasm_jspi_internal.js";
  async function load(path, options) {
    const pathString = pathToString(path);
    const isFullFilePath = pathString.endsWith(".wasm") || pathString.endsWith(".js");
    const relaxedSimd = await supportsFeature("relaxedSimd");
    if (options?.threads) {
      if (options?.jspi) {
        throw new Error(
          "The `threads` and `jspi` options are mutually exclusive."
        );
      }
      if (isFullFilePath) {
        console.warn(
          `The \`threads\` option was specified, but the wasm path ${pathString} is a full file path. Whether threads are available or not will depend on the loaded file. To allow LiteRT.js to load the threaded wasm file, use a directory path instead of a full file path.`
        );
      }
      if (!relaxedSimd) {
        throw new Error(
          "Threads are only supported with relaxed SIMD, and the current browser does not support relaxed SIMD."
        );
      }
      await throwIfFeatureNotSupported("threads");
    }
    if (options?.jspi) {
      if (isFullFilePath) {
        console.warn(
          `The \`jspi\` option was specified, but the wasm path ${pathString} is a full file path. Whether JSPI is available or not will depend on the loaded file. To allow LiteRT.js to load the JSPI wasm file, use a directory path instead of a full file path.`
        );
      }
      await throwIfFeatureNotSupported("jspi");
    }
    let fileName = WASM_JS_COMPAT_FILE_NAME;
    if (relaxedSimd) {
      if (options?.threads) {
        fileName = WASM_JS_THREADED_FILE_NAME;
      } else if (options?.jspi) {
        fileName = WASM_JS_JSPI_FILE_NAME;
      } else {
        fileName = WASM_JS_FILE_NAME;
      }
    }
    let jsFilePath = path;
    if (pathString.endsWith(".wasm")) {
      throw new Error(
        "Please load the `.js` file corresponding to the `.wasm` file, or load the directory containing it."
      );
    } else if (!pathString.endsWith(".js")) {
      jsFilePath = appendPathSegment(path, fileName);
    }
    return createWasmLib(LiteRt, jsFilePath);
  }
  function loadLiteRt(path, options) {
    if (hasGlobalLiteRtPromise()) {
      throw new Error("LiteRT is already loading / loaded.");
    }
    setGlobalLiteRtPromise(load(path, options).then(async (liteRt) => {
      setGlobalLiteRt(liteRt);
      liteRt.setDefaultEnvironment(
        await Environment.create()
      );
      return liteRt;
    }).catch((error2) => {
      setGlobalLiteRtPromise(void 0);
      throw error2;
    }));
    return getGlobalLiteRtPromise();
  }
  var compilationLock = Promise.resolve();
  async function copyHostMemoryToHostMemory(cpuTensor, options = {}) {
    const environment = options.environment ?? cpuTensor.environment;
    const liteRtWasm = getGlobalLiteRt().liteRtWasm;
    const srcTensorBuffer = cpuTensor.liteRtTensorBuffer;
    const bufferType = srcTensorBuffer.bufferType();
    if (bufferType.value !== TensorBufferType.HOST_MEMORY) {
      throw new Error(
        "Source tensor is not in host memory. Cannot copy to host memory."
      );
    }
    const srcTensorMemoryPtr = srcTensorBuffer.lock(
      liteRtWasm.LiteRtTensorBufferLockMode.READ
    );
    let destTensorBuffer;
    try {
      destTensorBuffer = liteRtWasm.LiteRtTensorBuffer.createManaged(
        environment.liteRtEnvironment,
        liteRtWasm.LiteRtTensorBufferType.HOST_MEMORY,
        srcTensorBuffer.tensorType(),
        srcTensorBuffer.size()
      );
      const destMemoryPointer = destTensorBuffer.lock(
        liteRtWasm.LiteRtTensorBufferLockMode.WRITE
      );
      try {
        const srcTensorMemoryView = new Uint8Array(
          liteRtWasm.HEAPU8.buffer,
          srcTensorMemoryPtr,
          srcTensorBuffer.size()
        );
        liteRtWasm.HEAPU8.set(srcTensorMemoryView, destMemoryPointer);
      } finally {
        destTensorBuffer.unlock();
      }
    } finally {
      srcTensorBuffer.unlock();
    }
    if (!destTensorBuffer) {
      throw new Error("Failed to create destination tensor buffer.");
    }
    return new Tensor(destTensorBuffer, environment);
  }
  async function cpuTensorToGpuTensor(cpuTensor, options = {}) {
    const environment = options.environment ?? cpuTensor.environment;
    const device = environment.webGpuDevice;
    if (!device) {
      throw new Error(
        "No WebGPU device is available. Did you forget to pass a destination environment that has a WebGPU device?"
      );
    }
    const liteRtWasm = getGlobalLiteRt().liteRtWasm;
    const byteLength = cpuTensor.liteRtTensorBuffer.size();
    const paddedByteLength = byteLength + 3 & ~3;
    const stagingBuffer = device.createBuffer({
      size: paddedByteLength,
      usage: GPUBufferUsage.MAP_WRITE | GPUBufferUsage.COPY_SRC,
      mappedAtCreation: true
    });
    const mappedBuffer = await stagingBuffer.getMappedRange();
    const mappedArray = new Uint8Array(mappedBuffer);
    const cpuMemoryPtr = cpuTensor.liteRtTensorBuffer.lock(
      liteRtWasm.LiteRtTensorBufferLockMode.READ
    );
    try {
      const cpuMemoryView = new Uint8Array(
        liteRtWasm.HEAPU8.buffer,
        cpuMemoryPtr,
        cpuTensor.liteRtTensorBuffer.size()
      );
      mappedArray.set(cpuMemoryView);
    } finally {
      cpuTensor.liteRtTensorBuffer.unlock();
    }
    stagingBuffer.unmap();
    const buffer = device.createBuffer({
      size: paddedByteLength,
      usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE
    });
    const commandEncoder = device.createCommandEncoder();
    commandEncoder.copyBufferToBuffer(
      stagingBuffer,
      0,
      buffer,
      0,
      paddedByteLength
    );
    device.queue.submit([commandEncoder.finish()]);
    stagingBuffer.destroy();
    return new Tensor(
      buffer,
      cpuTensor.type.layout.dimensions,
      cpuTensor.type.dtype,
      environment,
      () => {
        buffer.destroy();
      }
    );
  }
  async function gpuTensorToCpuTensor(gpuTensor, options = {}) {
    const environment = options.environment ?? gpuTensor.environment;
    const device = gpuTensor.environment.webGpuDevice;
    if (!device) {
      throw new Error(
        "No WebGPU device is available. Does the source tensor have a WebGPU device?"
      );
    }
    const liteRtWasm = getGlobalLiteRt().liteRtWasm;
    const tensorBuffer = gpuTensor.liteRtTensorBuffer;
    const bufferType = tensorBuffer.bufferType();
    if (bufferType !== liteRtWasm.LiteRtTensorBufferType.WEB_GPU_BUFFER_PACKED) {
      throw new Error(`Cannot convert a tensor with a non-WebGPU buffer type ${bufferType} to a CPU tensor.`);
    }
    const gpuBuffer = liteRtWasm.WebGPU.getJsObject(
      tensorBuffer.getWebGpuBuffer()
    );
    const byteOffset = tensorBuffer.offset();
    const tensorType = tensorBuffer.tensorType();
    const layout = tensorType.layout();
    const numElements = layout.numElements();
    const arrayConstructor = getDataType(tensorType.elementType().value).typedArrayConstructor;
    layout.delete();
    tensorType.delete();
    let mappableBuffer = gpuBuffer;
    let cleanupBuffer = () => {
    };
    if (!(gpuBuffer.usage & GPUBufferUsage.MAP_READ)) {
      mappableBuffer = device.createBuffer({
        size: gpuBuffer.size,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
      });
      cleanupBuffer = () => {
        mappableBuffer.destroy();
      };
      const commandEncoder = device.createCommandEncoder();
      commandEncoder.copyBufferToBuffer(
        gpuBuffer,
        0,
        mappableBuffer,
        0,
        gpuBuffer.size
      );
      device.queue.submit([commandEncoder.finish()]);
    }
    await mappableBuffer.mapAsync(GPUMapMode.READ);
    const mappedBuffer = mappableBuffer.getMappedRange();
    const mappedArray = new arrayConstructor(mappedBuffer, byteOffset, numElements);
    const cpuTensor = new Tensor(mappedArray, gpuTensor.type.layout.dimensions, environment);
    mappableBuffer.unmap();
    cleanupBuffer();
    return cpuTensor;
  }
  function makeMoveTo(copyTo) {
    return async (tensor, options) => {
      const result = await copyTo(tensor, options);
      tensor.delete();
      return result;
    };
  }
  function registerCopyFunctions() {
    Tensor.copyFunctions.set(TensorBufferType.HOST_MEMORY, /* @__PURE__ */ new Map([
      [
        TensorBufferType.HOST_MEMORY,
        {
          copyTo: copyHostMemoryToHostMemory,
          // There might be a more efficient way to move
          // from CPU to CPU.
          moveTo: makeMoveTo(copyHostMemoryToHostMemory)
        }
      ],
      [
        TensorBufferType.WEB_GPU_BUFFER_PACKED,
        {
          copyTo: cpuTensorToGpuTensor,
          moveTo: makeMoveTo(cpuTensorToGpuTensor)
        }
      ]
    ]));
    Tensor.copyFunctions.set(TensorBufferType.WEB_GPU_BUFFER_PACKED, /* @__PURE__ */ new Map([
      [
        TensorBufferType.HOST_MEMORY,
        {
          copyTo: gpuTensorToCpuTensor,
          moveTo: makeMoveTo(gpuTensorToCpuTensor)
        }
      ]
    ]));
  }
  registerCopyFunctions();

  // src/offscreen/g2p.js
  var TOKEN = /[a-z']+|\d+(?:\.\d+)?|[.,!?;:—…"]/g;
  var WORD = /^[a-z']+$/;
  var ONES = [
    "zero",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen"
  ];
  var TENS = [
    "",
    "",
    "twenty",
    "thirty",
    "forty",
    "fifty",
    "sixty",
    "seventy",
    "eighty",
    "ninety"
  ];
  function intToWords(n) {
    if (n < 20) return ONES[n];
    if (n < 100) return TENS[n / 10 | 0] + (n % 10 ? " " + ONES[n % 10] : "");
    if (n < 1e3) return ONES[n / 100 | 0] + " hundred" + (n % 100 ? " " + intToWords(n % 100) : "");
    for (const [div, name] of [[1e9, "billion"], [1e6, "million"], [1e3, "thousand"]]) {
      if (n >= div) {
        const head = intToWords(Math.floor(n / div)) + " " + name;
        return head + (n % div ? " " + intToWords(n % div) : "");
      }
    }
    return ONES[0];
  }
  function numberToWords(tok) {
    const [int, frac] = tok.split(".");
    let out = int.length > 12 ? [...int].map((d) => ONES[+d]).join(" ") : intToWords(parseInt(int, 10));
    if (frac !== void 0) out += " point " + [...frac].map((d) => ONES[+d]).join(" ");
    return out;
  }
  var G2P = class {
    /**
     * @param dict Map<string,string> word → espeak-IPA
     * @param meta g2p_meta.json contents
     * @param model dp_g2p compiled model (WASM) or null (dictionary-only)
     */
    constructor(dict, meta, model) {
      this.dict = dict;
      this.meta = meta;
      this.model = model;
      this.special = new Set(meta.special);
      this.cache = /* @__PURE__ */ new Map();
    }
    async wordToIpa(word) {
      const hit = this.dict.get(word);
      if (hit !== void 0) return hit;
      let ipa = this.cache.get(word);
      if (ipa === void 0) {
        ipa = this.model ? await this.neural(word) : "";
        this.cache.set(word, ipa);
      }
      return ipa;
    }
    async neural(word) {
      const { char2idx, idx2ph, char_repeats: rep, start, end, MAXT, n_phonemes: nph } = this.meta;
      const ids = [start];
      for (const ch of word) {
        const id = char2idx[ch];
        if (id !== void 0) for (let r = 0; r < rep; r++) ids.push(id);
      }
      ids.push(end);
      const L = Math.min(ids.length, MAXT);
      const input = new Float32Array(MAXT);
      for (let i = 0; i < L; i++) input[i] = ids[i];
      const inT = Tensor.fromTypedArray(input, [1, MAXT]);
      const outs = await this.model.run([inT]);
      const logits = await outs[0].data();
      for (const o of outs) o.delete();
      inT.delete();
      let prev = -1;
      let out = "";
      for (let pos = 0; pos < L; pos++) {
        let best = 0;
        let bestV = -Infinity;
        for (let k = 0; k < nph; k++) {
          const v = logits[pos * nph + k];
          if (v > bestV) {
            bestV = v;
            best = k;
          }
        }
        if (best === prev) continue;
        prev = best;
        const ph = idx2ph[best];
        if (best === 0 || ph === void 0 || this.special.has(ph)) continue;
        out += ph.replaceAll("-", "");
      }
      return out;
    }
  };
  async function phonemize(g2p2, symToId2, text, maxPids = 127) {
    const spaceId = symToId2.get(" ");
    const pieces = [];
    for (const m of text.toLowerCase().matchAll(TOKEN)) {
      const tok = m[0];
      let words = null;
      if (/^\d/.test(tok)) words = numberToWords(tok).split(" ");
      else if (WORD.test(tok)) words = [tok];
      if (words) {
        for (const w of words) {
          const ipa = await g2p2.wordToIpa(w);
          if (!ipa) continue;
          const ids = [];
          for (const ch of ipa) {
            const id = symToId2.get(ch);
            if (id !== void 0) ids.push(id);
          }
          if (ids.length) pieces.push({ ids, ipa, isWord: true, sentenceEnd: false });
        }
      } else {
        const norm = tok === "!" ? "." : tok;
        const id = symToId2.get(norm);
        if (id !== void 0) {
          pieces.push({ ids: [id], ipa: norm, isWord: false, sentenceEnd: /[.!?…]/.test(norm) });
        }
      }
    }
    const chunks = [];
    let cur = { ids: [], ipa: "" };
    const flush = () => {
      if (cur.ids.length) chunks.push(cur);
      cur = { ids: [], ipa: "" };
    };
    for (const p of pieces) {
      const sep = p.isWord && cur.ids.length ? 1 : 0;
      if (cur.ids.length + sep + p.ids.length > maxPids) flush();
      if (p.isWord && cur.ids.length) {
        cur.ids.push(spaceId);
        cur.ipa += " ";
      }
      cur.ids.push(...p.ids);
      cur.ipa += p.ipa;
      if (p.sentenceEnd) flush();
    }
    flush();
    return chunks;
  }

  // src/offscreen/synth.js
  function makeRandn(seed) {
    let s = seed >>> 0;
    const uniform = () => {
      s = s + 1831565813 | 0;
      let t = Math.imul(s ^ s >>> 15, 1 | s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
    let spare = null;
    return () => {
      if (spare !== null) {
        const v = spare;
        spare = null;
        return v;
      }
      let a = 0;
      while (a === 0) a = uniform();
      const r = Math.sqrt(-2 * Math.log(a));
      const th = 2 * Math.PI * uniform();
      spare = r * Math.sin(th);
      return r * Math.cos(th);
    };
  }
  function sinPosEmb(t, dim) {
    const half = dim / 2;
    const out = new Float32Array(dim);
    const k = -Math.log(1e4) / (half - 1);
    for (let i = 0; i < half; i++) {
      const e = 1e3 * t * Math.exp(i * k);
      out[i] = Math.sin(e);
      out[half + i] = Math.cos(e);
    }
    return out;
  }
  var Synthesizer = class {
    /**
     * @param models {textenc, decoder, vocoder} compiled LiteRT models
     * @param emb Float32Array 178×192 phoneme embedding table (emb.bin)
     * @param cfg config.json contents
     */
    constructor(models, emb, cfg2) {
      this.m = models;
      this.emb = emb;
      this.cfg = cfg2;
    }
    /**
     * @param pids symbol ids (≤ (MAX_TEXT-1)/2)
     * @returns {wav, ylen, mel, timings} — wav trimmed+clipped, mel [80×MAX_MEL]
     */
    async run(pids, { steps = 10, seed = 0 } = {}) {
      const {
        MAX_TEXT,
        MAX_MEL,
        n_feats: F,
        n_channels: CH,
        hop,
        mel_mean,
        mel_std,
        length_scale,
        in_channels: TDIM
      } = this.cfg;
      const timings = { textenc: 0, decoder: 0, vocoder: 0 };
      const embx = new Float32Array(MAX_TEXT * CH);
      for (let t = 0; t < MAX_TEXT; t++) {
        const k = (t - 1) / 2;
        const row = t % 2 === 1 && k < pids.length ? pids[k] : 0;
        embx.set(this.emb.subarray(row * CH, row * CH + CH), t * CH);
      }
      const tx = Math.min(pids.length * 2 + 1, MAX_TEXT);
      const tmask = new Float32Array(MAX_TEXT);
      for (let t = 0; t < tx; t++) tmask[t] = 1;
      let t0 = performance.now();
      const embT = Tensor.fromTypedArray(embx, [1, MAX_TEXT, CH]);
      const tmT = Tensor.fromTypedArray(tmask, [1, 1, MAX_TEXT]);
      const teOuts = await this.m.textenc.run([embT, tmT]);
      const teBufs = [];
      for (const o of teOuts) teBufs.push(await o.data());
      for (const o of teOuts) o.delete();
      embT.delete();
      tmT.delete();
      const [mu, logw] = teBufs[0].length === F * MAX_TEXT ? [teBufs[0], teBufs[1]] : [teBufs[1], teBufs[0]];
      timings.textenc += performance.now() - t0;
      const cum = new Float64Array(MAX_TEXT);
      let acc = 0;
      for (let t = 0; t < MAX_TEXT; t++) {
        acc += Math.ceil(Math.exp(logw[t]) * tmask[t]) * length_scale;
        cum[t] = acc;
      }
      const ylen = Math.min(Math.max(Math.trunc(acc), 1), MAX_MEL);
      const muY = new Float32Array(F * MAX_MEL);
      let p = 0;
      for (let f = 0; f < ylen; f++) {
        while (p < MAX_TEXT - 1 && cum[p] <= f) p++;
        for (let c = 0; c < F; c++) muY[c * MAX_MEL + f] = mu[c * MAX_TEXT + p];
      }
      const ymask = new Float32Array(MAX_MEL);
      for (let f = 0; f < ylen; f++) ymask[f] = 1;
      const randn = makeRandn(seed);
      const x = new Float32Array(F * MAX_MEL);
      for (let c = 0; c < F; c++) {
        for (let f = 0; f < ylen; f++) x[c * MAX_MEL + f] = randn();
      }
      const dt = 1 / steps;
      t0 = performance.now();
      for (let s = 0; s < steps; s++) {
        const xT = Tensor.fromTypedArray(x, [1, F, MAX_MEL]);
        const muT = Tensor.fromTypedArray(muY, [1, F, MAX_MEL]);
        const tsT = Tensor.fromTypedArray(sinPosEmb(s / steps, TDIM), [1, TDIM]);
        const ymT = Tensor.fromTypedArray(ymask, [1, 1, MAX_MEL]);
        const outs = await this.m.decoder.run([xT, muT, tsT, ymT]);
        const v = await outs[0].data();
        for (const o of outs) o.delete();
        xT.delete();
        muT.delete();
        tsT.delete();
        ymT.delete();
        for (let i = 0; i < x.length; i++) x[i] += dt * v[i];
      }
      timings.decoder += performance.now() - t0;
      const mel = new Float32Array(F * MAX_MEL);
      for (let c = 0; c < F; c++) {
        for (let f = 0; f < ylen; f++) {
          mel[c * MAX_MEL + f] = x[c * MAX_MEL + f] * mel_std + mel_mean;
        }
      }
      t0 = performance.now();
      const wav = await this.vocode(mel, ylen);
      timings.vocoder += performance.now() - t0;
      return { wav, ylen, mel, timings };
    }
    /** mel [1,80,MAX_MEL] → trimmed, clipped waveform (ylen·hop samples). */
    async vocode(mel, ylen, model = this.m.vocoder) {
      const { MAX_MEL, n_feats: F, hop } = this.cfg;
      const melT = Tensor.fromTypedArray(mel, [1, F, MAX_MEL]);
      const outs = await model.run([melT]);
      const wavFull = await outs[0].data();
      for (const o of outs) o.delete();
      melT.delete();
      const n = ylen * hop;
      const wav = new Float32Array(n);
      for (let i = 0; i < n; i++) wav[i] = Math.max(-1, Math.min(1, wavFull[i]));
      return wav;
    }
  };

  // src/offscreen/main.js
  var HF = "https://huggingface.co/litert-community/Matcha-TTS/resolve/main/";
  var FILES = {
    textenc: "matcha_textenc_fp16.tflite",
    decoder: "matcha_decoder_fp16.tflite",
    vocoder: "matcha_vocoder_fp16.tflite",
    g2p: "dp_g2p_matcha_fp16.tflite",
    emb: "emb.bin",
    dict: "g2p_dict.txt.gz",
    config: "config.json",
    g2pMeta: "g2p_meta.json"
  };
  var CACHE_NAME = "page-voice-models-v1";
  var STEPS = 4;
  var SEED = 0;
  var state = "loading";
  var error = null;
  var backends = null;
  var wasmOpts = null;
  var g2p = null;
  var synth = null;
  var cfg = null;
  var symToId = null;
  var audioCtx = null;
  var playCursor = null;
  var liveSources = [];
  var queue = [];
  var processing = false;
  var generation = 0;
  var lastStats = null;
  var downloadedMB = 0;
  var spokenCount = 0;
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || msg.target !== "offscreen") return;
    if (msg.type === "speak") {
      enqueue(msg.text);
      sendResponse({ ok: true });
    } else if (msg.type === "stop") {
      stopAll();
      sendResponse({ ok: true });
    } else if (msg.type === "status") {
      sendResponse(statusPayload());
    }
    return false;
  });
  function speaking() {
    return processing || queue.length > 0 || playCursor !== null && audioCtx && playCursor > audioCtx.currentTime;
  }
  function statusPayload() {
    return {
      target: "ui",
      type: "status",
      state,
      speaking: speaking(),
      error,
      env: envLabel(),
      flags: {
        webgpu: backends ? backends.textenc === "webgpu" : null,
        threads: wasmOpts?.threads ?? null,
        jspi: wasmOpts?.jspi ?? null,
        crossOriginIsolated: globalThis.crossOriginIsolated
      },
      backends,
      stats: lastStats,
      queued: queue.length,
      downloadedMB,
      spoken: spokenCount
    };
  }
  function envLabel() {
    if (!backends) return null;
    const gpu = backends.textenc === "webgpu" || backends.vocoder === "webgpu";
    return gpu ? "webgpu+wasm" : wasmOpts?.threads ? "wasm" : "wasm\xB71-thread";
  }
  var lastBroadcast = 0;
  function broadcast(force = false) {
    const now = performance.now();
    if (!force && now - lastBroadcast < 250) return;
    lastBroadcast = now;
    chrome.runtime.sendMessage(statusPayload()).catch(() => {
    });
  }
  async function fetchCached(name, onProgress) {
    const url = HF + name;
    const cache = "caches" in globalThis ? await caches.open(CACHE_NAME) : null;
    if (cache) {
      const hit = await cache.match(url);
      if (hit) {
        const bytes2 = new Uint8Array(await hit.arrayBuffer());
        onProgress?.(bytes2.length);
        return bytes2;
      }
    }
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
    const reader = response.body.getReader();
    const chunks = [];
    let received = 0;
    for (; ; ) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      onProgress?.(received);
    }
    const bytes = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    if (cache) await cache.put(url, new Response(bytes.slice().buffer));
    return bytes;
  }
  async function gunzip(bytes) {
    if (bytes[0] !== 31 || bytes[1] !== 139) return bytes;
    const ds = new DecompressionStream("gzip");
    const stream = new Blob([bytes]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  function parseDict(bytes) {
    const text = new TextDecoder().decode(bytes);
    const dict = /* @__PURE__ */ new Map();
    let start = 0;
    while (start < text.length) {
      let end = text.indexOf("\n", start);
      if (end === -1) end = text.length;
      const tab = text.indexOf("	", start);
      if (tab > start && tab < end) {
        dict.set(text.slice(start, tab), text.slice(tab + 1, end));
      }
      start = end + 1;
    }
    return dict;
  }
  async function boot() {
    try {
      const coi = globalThis.crossOriginIsolated;
      const attempts = [
        { threads: coi, jspi: true },
        { threads: coi, jspi: false },
        { threads: false, jspi: true },
        { threads: false, jspi: false }
      ];
      let loaded = false;
      let lastErr = null;
      for (const opts of attempts) {
        try {
          await loadLiteRt("litert-wasm/", opts);
          wasmOpts = opts;
          loaded = true;
          break;
        } catch (err) {
          lastErr = err;
        }
      }
      if (!loaded) throw lastErr;
      const gpu = isWebGPUSupported() ? "webgpu" : "wasm";
      backends = { g2p: "wasm", textenc: gpu, decoder: "wasm", vocoder: gpu };
      state = "downloading";
      broadcast(true);
      const progress = {};
      const grab = (name) => fetchCached(FILES[name], (received) => {
        progress[name] = received;
        let done = 0;
        for (const k in progress) done += progress[k];
        downloadedMB = Math.round(done / 1048576);
        broadcast();
      });
      const [teB, deB, voB, g2pB, embB, dictB, cfgB, metaB] = await Promise.all([
        grab("textenc"),
        grab("decoder"),
        grab("vocoder"),
        grab("g2p"),
        grab("emb"),
        grab("dict"),
        grab("config"),
        grab("g2pMeta")
      ]);
      state = "compiling";
      broadcast(true);
      cfg = JSON.parse(new TextDecoder().decode(cfgB));
      const meta = JSON.parse(new TextDecoder().decode(metaB));
      symToId = /* @__PURE__ */ new Map();
      cfg.symbols.forEach((s, i) => {
        if (s.length === 1) symToId.set(s, i);
      });
      const dict = parseDict(await gunzip(dictB));
      const emb = new Float32Array(embB.buffer, embB.byteOffset, embB.byteLength / 4);
      const numThreads = Math.min(8, navigator.hardwareConcurrency || 4);
      const wasmCompile = { accelerator: "wasm", cpuOptions: { numThreads } };
      const models = {};
      for (const [key, bytes] of [["textenc", teB], ["decoder", deB], ["vocoder", voB], ["g2p", g2pB]]) {
        if (backends[key] === "wasm") {
          models[key] = await loadAndCompile(bytes, wasmCompile);
          continue;
        }
        try {
          models[key] = await loadAndCompile(bytes, { accelerator: backends[key] });
        } catch {
          backends[key] = "wasm";
          models[key] = await loadAndCompile(bytes, wasmCompile);
        }
      }
      g2p = new G2P(dict, meta, models.g2p);
      synth = new Synthesizer(models, emb, cfg);
      state = "ready";
      broadcast(true);
      processQueue();
    } catch (err) {
      state = "error";
      error = String(err instanceof Error ? err.message : err);
      broadcast(true);
    }
  }
  function enqueue(text) {
    text = (text ?? "").trim();
    if (!text) return;
    spokenCount++;
    queue.push(text);
    broadcast(true);
    processQueue();
  }
  function stopAll() {
    generation++;
    queue = [];
    for (const src of liveSources) {
      try {
        src.stop();
      } catch {
      }
    }
    liveSources = [];
    playCursor = null;
    broadcast(true);
  }
  async function processQueue() {
    if (processing || state !== "ready") return;
    processing = true;
    try {
      audioCtx ??= new AudioContext({ sampleRate: cfg.sample_rate });
      if (audioCtx.state === "suspended") {
        await audioCtx.resume().catch(() => {
        });
        if (audioCtx.state === "suspended") {
          error = "AudioContext suspended \u2014 autoplay blocked in offscreen document";
          broadcast(true);
        }
      }
      while (queue.length) {
        const gen = generation;
        const text = queue.shift();
        broadcast(true);
        await speakText(text, gen);
      }
    } finally {
      processing = false;
      broadcast(true);
    }
  }
  async function speakText(text, gen) {
    const t0 = performance.now();
    const chunks = await phonemize(g2p, symToId, text);
    const tG2p = performance.now() - t0;
    if (!chunks.length) return;
    const timings = { g2p: tG2p, textenc: 0, decoder: 0, vocoder: 0 };
    let audioSeconds = 0;
    for (const chunk of chunks) {
      if (gen !== generation) return;
      const r = await synth.run(chunk.ids, { steps: STEPS, seed: SEED });
      if (gen !== generation) return;
      for (const k of ["textenc", "decoder", "vocoder"]) timings[k] += r.timings[k];
      audioSeconds += r.wav.length / cfg.sample_rate;
      playWav(r.wav);
      const totalMs = timings.g2p + timings.textenc + timings.decoder + timings.vocoder;
      lastStats = {
        totalMs: +totalMs.toFixed(0),
        audioSeconds: +audioSeconds.toFixed(1),
        rtf: +(totalMs / 1e3 / audioSeconds).toFixed(2),
        steps: STEPS
      };
      broadcast(true);
    }
  }
  function playWav(wav) {
    const buf = audioCtx.createBuffer(1, wav.length, cfg.sample_rate);
    buf.copyToChannel(wav, 0);
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    src.connect(audioCtx.destination);
    const at = Math.max(playCursor ?? 0, audioCtx.currentTime + 0.05);
    src.start(at);
    if (false) mirrorToSink(wav, at);
    playCursor = at + buf.duration;
    liveSources.push(src);
    src.onended = () => {
      liveSources = liveSources.filter((s) => s !== src);
      broadcast();
    };
  }
  globalThis.__pv = {
    get status() {
      return statusPayload();
    },
    speak: (text) => enqueue(text),
    stop: stopAll
  };
  boot();
})();
