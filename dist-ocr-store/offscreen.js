(() => {
  // node_modules/@litertjs/wasm-utils/dist/index.js
  async function runScript(scriptUrl) {
    if (typeof importScripts == "function")
      importScripts(scriptUrl.toString());
    else {
      let script = document.createElement("script");
      return script.src = scriptUrl.toString(), script.crossOrigin = "anonymous", new Promise((resolve, revoke) => {
        script.addEventListener("load", () => {
          resolve();
        }, !1), script.addEventListener("error", (e) => {
          revoke(e);
        }, !1), document.body.appendChild(script);
      });
    }
  }
  var createWasmLib = async (constructorFcn, wasmLoaderScript, assetLoaderScript, glCanvas, fileLocator) => {
    if (wasmLoaderScript && await runScript(wasmLoaderScript), !self.ModuleFactory)
      throw new Error("ModuleFactory not set.");
    if (assetLoaderScript && (await runScript(assetLoaderScript), !self.ModuleFactory))
      throw new Error("ModuleFactory not set.");
    if (self.Module && fileLocator) {
      let moduleFileLocator = self.Module;
      moduleFileLocator.locateFile = fileLocator.locateFile, fileLocator.mainScriptUrlOrBlob && (moduleFileLocator.mainScriptUrlOrBlob = fileLocator.mainScriptUrlOrBlob);
    }
    let module = await self.ModuleFactory(self.Module || fileLocator);
    return self.ModuleFactory = self.Module = void 0, new constructorFcn(module, glCanvas);
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
  }, ElementTypeName = {
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
  }, TensorBufferType = {
    HOST_MEMORY: 1,
    WEB_GPU_BUFFER: 20,
    WEB_GPU_BUFFER_FP16: 21,
    WEB_GPU_BUFFER_PACKED: 26
  }, TensorBufferTypeName = {
    [TensorBufferType.HOST_MEMORY]: "HOST_MEMORY",
    [TensorBufferType.WEB_GPU_BUFFER]: "WEB_GPU_BUFFER",
    [TensorBufferType.WEB_GPU_BUFFER_FP16]: "WEB_GPU_BUFFER_FP16",
    [TensorBufferType.WEB_GPU_BUFFER_PACKED]: "WEB_GPU_BUFFER_PACKED"
  }, DATATYPES = Object.freeze([
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
    for (let dataTypeMapping of DATATYPES)
      if (dataTypeMapping.dtype === val || dataTypeMapping.typedArrayConstructor === val || val instanceof dataTypeMapping.typedArrayConstructor || dataTypeMapping.elementType === val)
        return dataTypeMapping;
    throw typeof val == "string" ? new Error(`DType ${val} is not supported.`) : val instanceof Object ? new Error(`Typed array ${"name" in val ? val.name : val.constructor.name} is not supported.`) : new Error(
      `Element type ${ElementTypeName[val] ?? val} is not supported.`
    );
  }
  var LiteRtNotLoadedError = class extends Error {
    constructor() {
      super(
        "LiteRT is not initialized yet. Please call loadLiteRt() and wait for its promise to resolve to load the LiteRT WASM module."
      );
    }
  }, globalLiteRt = void 0, globalLiteRtPromise = void 0;
  function getGlobalLiteRt() {
    if (!globalLiteRt)
      throw new LiteRtNotLoadedError();
    return globalLiteRt;
  }
  function setGlobalLiteRt(liteRt) {
    globalLiteRt = liteRt;
  }
  function getGlobalLiteRtPromise() {
    return globalLiteRtPromise;
  }
  function hasGlobalLiteRtPromise() {
    return !!globalLiteRtPromise;
  }
  function setGlobalLiteRtPromise(promise) {
    globalLiteRtPromise = promise;
  }
  var AcceleratorDefaultTensorBufferType = {
    webgpu: TensorBufferType.WEB_GPU_BUFFER_PACKED,
    wasm: TensorBufferType.HOST_MEMORY
  }, TensorBufferTypeToAccelerator = {
    [TensorBufferType.HOST_MEMORY]: "wasm",
    [TensorBufferType.WEB_GPU_BUFFER]: "webgpu",
    [TensorBufferType.WEB_GPU_BUFFER_FP16]: "webgpu",
    [TensorBufferType.WEB_GPU_BUFFER_PACKED]: "webgpu"
  }, DESIRED_WEBGPU_FEATURES = [
    "shader-f16",
    "subgroups"
  ], Environment = class _Environment {
    constructor(options) {
      this.options = options, this.liteRtEnvironment = getGlobalLiteRt().liteRtWasm.LiteRtEnvironment.create(
        options.webGpuDevice
      );
    }
    liteRtEnvironment;
    static async create(options = {}) {
      let webGpuDevice = null;
      if ("webGpuDevice" in options)
        options.webGpuDevice && (webGpuDevice = options.webGpuDevice);
      else
        try {
          webGpuDevice = await createDefaultWebGpuDevice();
        } catch (e) {
          console.warn("Failed to create default WebGPU device:", e);
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
    let adapterDescriptor = {
      powerPreference: "high-performance"
    }, adapter = await navigator.gpu.requestAdapter(adapterDescriptor);
    if (!adapter)
      throw new Error("No GPU adapter found.");
    let requiredLimits = {
      maxBufferSize: adapter.limits.maxBufferSize,
      maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
      maxStorageBuffersPerShaderStage: adapter.limits.maxStorageBuffersPerShaderStage,
      maxTextureDimension2D: adapter.limits.maxTextureDimension2D
    }, requiredFeatures = [];
    for (let feature of DESIRED_WEBGPU_FEATURES)
      adapter.features.has(feature) && requiredFeatures.push(feature);
    return await adapter.requestDevice({
      requiredFeatures,
      requiredLimits
    });
  }
  function emscriptenVectorToArray(vector) {
    let array = new Array(vector.size());
    for (let i = 0; i < vector.size(); ++i)
      array[i] = vector.get(i);
    return vector.delete(), array;
  }
  function fillEmscriptenVector(data, vector) {
    for (let item of data)
      vector.push_back(item);
  }
  function parseData(remainingArgs) {
    let data = remainingArgs.shift(), liteRtWasm = getGlobalLiteRt().liteRtWasm;
    if (data instanceof liteRtWasm.LiteRtTensorBuffer)
      return { liteRtTensorBuffer: data };
    if (ArrayBuffer.isView(data))
      return { typedArray: data };
    if (data instanceof GPUBuffer)
      return { gpuBuffer: data };
    throw new Error(
      `Unknown type (${data?.constructor.name ?? data}) provided to create a Tensor`
    );
  }
  function parseShape(remainingArgs) {
    return Array.isArray(remainingArgs[0]) || remainingArgs[0] instanceof Int32Array ? { shape: remainingArgs.shift() } : {};
  }
  function shiftUntilDefined(remainingArgs) {
    for (; remainingArgs.length > 0 && remainingArgs[0] === void 0; )
      remainingArgs.shift();
  }
  function parseDataType(remainingArgs) {
    if (shiftUntilDefined(remainingArgs), typeof remainingArgs[0] == "string") {
      let dtype = remainingArgs.shift();
      return { dataType: getDataType(dtype).dtype };
    } else
      return {};
  }
  function parseEnvironment(remainingArgs) {
    return shiftUntilDefined(remainingArgs), remainingArgs[0] instanceof Environment ? { environment: remainingArgs.shift() } : {};
  }
  function parseOnDelete(remainingArgs) {
    return shiftUntilDefined(remainingArgs), remainingArgs[0] instanceof Function ? { onDelete: remainingArgs.shift() } : {};
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
    deletedInternal = !1;
    onDelete;
    static copyFunctions = /* @__PURE__ */ new Map();
    constructor(a, b, c, d, e) {
      let {
        typedArray,
        gpuBuffer,
        liteRtTensorBuffer,
        shape,
        dataType,
        environment,
        onDelete
      } = parseArgs([a, b, c, d, e]);
      if (this.onDelete = onDelete, this.environment = environment ?? getGlobalLiteRt().getDefaultEnvironment(), liteRtTensorBuffer) {
        if (shape)
          throw new Error(
            "A LiteRtTensorBuffer cannot be provided with a shape."
          );
        if (dataType)
          throw new Error(
            "A LiteRtTensorBuffer cannot be provided with a data type."
          );
        this.liteRtTensorBuffer = liteRtTensorBuffer;
      } else if (gpuBuffer) {
        if (!shape)
          throw new Error("A GPUBuffer must be provided with a shape.");
        if (!dataType)
          throw new Error("A GPUBuffer must be provided with a data type.");
        let [liteRtTensorBuffer2, webGpuBufferPtr] = webGpuBufferToLiteRtTensorBuffer(
          gpuBuffer,
          shape,
          dataType,
          this.environment
        );
        this.liteRtTensorBuffer = liteRtTensorBuffer2;
        let onDelete2 = this.onDelete;
        this.onDelete = () => {
          getGlobalLiteRt().liteRtWasm.wgpuBufferRelease(webGpuBufferPtr), onDelete2?.();
        };
      } else if (typedArray)
        this.liteRtTensorBuffer = typedArrayToLiteRtTensorBuffer(
          typedArray,
          shape,
          environment
        );
      else
        throw new Error("No data provided to create a Tensor.");
      this.type = liteRtTensorBufferToTensorType(this.liteRtTensorBuffer);
    }
    static fromTypedArray(data, shape, environment) {
      return new _Tensor(data, shape, environment);
    }
    ensureNotDeleted() {
      if (this.deleted)
        throw new Error("Tensor is deleted and cannot be used.");
    }
    async data() {
      if (this.ensureNotDeleted(), this.liteRtTensorBuffer.bufferType().value === TensorBufferType.HOST_MEMORY)
        return this.toTypedArray();
      let copy = await this.copyTo("wasm"), data = await copy.data();
      return copy.delete(), data;
    }
    toTypedArray() {
      this.ensureNotDeleted();
      let liteRtWasm = getGlobalLiteRt().liteRtWasm;
      if (this.liteRtTensorBuffer.isWebGpuMemory())
        throw new Error(
          "Cannot convert a Tensor with WebGPU memory to a TypedArray."
        );
      if (this.liteRtTensorBuffer.bufferType().value !== liteRtWasm.LiteRtTensorBufferType.HOST_MEMORY.value)
        throw new Error(
          "Cannot convert a Tensor with non-host memory to a TypedArray."
        );
      if (this.liteRtTensorBuffer.size() !== this.liteRtTensorBuffer.packedSize() || this.liteRtTensorBuffer.offset() !== 0)
        throw new Error("Tensors with strides or padding are not yet supported.");
      let rankedTensorType = this.liteRtTensorBuffer.tensorType(), elementType = rankedTensorType.elementType(), byteWidth = liteRtWasm.liteRtGetByteWidth(elementType);
      rankedTensorType.delete();
      let typedArrayConstructor = getDataType(
        elementType.value
      ).typedArrayConstructor;
      if (typedArrayConstructor.BYTES_PER_ELEMENT !== byteWidth)
        throw new Error(
          `Byte width ${byteWidth} of the tensor's element type ${ElementTypeName[elementType.value]} does not match the expected byte width ${typedArrayConstructor.BYTES_PER_ELEMENT} of the ${typedArrayConstructor.name}.`
        );
      let dataPtr = this.liteRtTensorBuffer.lock(
        getGlobalLiteRt().liteRtWasm.LiteRtTensorBufferLockMode.READ
      );
      try {
        let uint8Array = liteRtWasm.HEAPU8.slice(
          dataPtr,
          dataPtr + this.liteRtTensorBuffer.packedSize()
        );
        return new typedArrayConstructor(
          uint8Array.buffer,
          uint8Array.byteOffset,
          uint8Array.byteLength / byteWidth
        );
      } finally {
        this.liteRtTensorBuffer.unlock();
      }
    }
    getBufferType() {
      return this.ensureNotDeleted(), this.liteRtTensorBuffer.bufferType().value;
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
      let liteRtWasm = getGlobalLiteRt().liteRtWasm;
      if (!this.liteRtTensorBuffer.isWebGpuMemory())
        throw new Error(
          "Cannot convert a Tensor with non-WebGPU memory to a GPUBuffer."
        );
      let bufferTypeValue = this.liteRtTensorBuffer.bufferType().value;
      if (bufferTypeValue !== liteRtWasm.LiteRtTensorBufferType.WEB_GPU_BUFFER.value && bufferTypeValue !== liteRtWasm.LiteRtTensorBufferType.WEB_GPU_BUFFER_FP16.value && bufferTypeValue !== liteRtWasm.LiteRtTensorBufferType.WEB_GPU_BUFFER_PACKED.value)
        throw new Error(
          "Cannot convert a Tensor with host memory to a GPUBuffer."
        );
      if (this.liteRtTensorBuffer.size() !== this.liteRtTensorBuffer.packedSize() || this.liteRtTensorBuffer.offset() !== 0)
        throw new Error("Tensors with strides or padding are not yet supported.");
      let gpuBufferId = this.liteRtTensorBuffer.getWebGpuBuffer();
      return liteRtWasm.WebGPU.getJsObject(gpuBufferId);
    }
    getCopyFunctionSet(destination) {
      this.ensureNotDeleted();
      let sourceBufferType = this.getBufferType(), copyFunctions = _Tensor.copyFunctions.get(sourceBufferType);
      if (!copyFunctions)
        throw new Error(
          `TensorBufferType ${TensorBufferTypeName[sourceBufferType] ?? sourceBufferType} does not support copying or moving`
        );
      let destinationBufferType = typeof destination == "string" ? AcceleratorDefaultTensorBufferType[destination] : destination;
      if (destinationBufferType == null)
        throw new Error(
          `Unknown destination '${destination}' for copying or moving.`
        );
      let copyFunctionSet = copyFunctions.get(destinationBufferType);
      if (!copyFunctionSet) {
        let supportedDestinations = [...copyFunctions].map(
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
      let [copyFunctionSet, destinationBufferType] = this.getCopyFunctionSet(destination);
      if (!copyFunctionSet.copyTo)
        throw new Error(
          `Copying to ${TensorBufferTypeName[destinationBufferType]} is not supported by this tensor.`
        );
      return copyFunctionSet.copyTo(this, options);
    }
    /**
     * Moves the tensor to the given accelerator.
     *
     * @param destination The accelerator or buffer type to move to.
     * @return A promise that resolves to the moved tensor.
     */
    async moveTo(destination, options) {
      let [copyFunctionSet, destinationBufferType] = this.getCopyFunctionSet(destination);
      if (!copyFunctionSet.moveTo)
        throw new Error(
          `Moving to ${TensorBufferTypeName[destinationBufferType]} is not supported by this tensor.`
        );
      return copyFunctionSet.moveTo(this, options);
    }
    get bufferType() {
      return this.liteRtTensorBuffer.bufferType().value;
    }
    get accelerator() {
      let accelerator = TensorBufferTypeToAccelerator[this.bufferType];
      if (accelerator === void 0)
        throw new Error(
          `TensorBufferType ${TensorBufferTypeName[this.bufferType]} has an unknown accelerator type.`
        );
      return accelerator;
    }
    get deleted() {
      return this.deletedInternal;
    }
    delete() {
      this.deletedInternal || (this.deletedInternal = !0, this.liteRtTensorBuffer.delete(), this.onDelete?.());
    }
  };
  function liteRtTensorBufferToTensorType(liteRtTensorBuffer) {
    let liteRtRankedTensorType = liteRtTensorBuffer.tensorType(), elementType = liteRtRankedTensorType.elementType(), liteRtLayout = liteRtRankedTensorType.layout(), dimensions = liteRtLayout.dimensions();
    return liteRtLayout.delete(), liteRtRankedTensorType.delete(), {
      dtype: getDataType(elementType.value).dtype,
      layout: { dimensions: emscriptenVectorToArray(dimensions) }
    };
  }
  function webGpuBufferToLiteRtTensorBuffer(gpuBuffer, shape, dtype, environment) {
    let liteRtWasm = getGlobalLiteRt().liteRtWasm, dimensionsVector = new liteRtWasm.VectorInt32();
    fillEmscriptenVector(shape, dimensionsVector);
    let layout = liteRtWasm.LiteRtLayout.create(dimensionsVector);
    dimensionsVector.delete();
    let rankedTensorType = liteRtWasm.LiteRtRankedTensorType.create(
      { value: getDataType(dtype).elementType },
      layout
    );
    layout.delete();
    let importedGpuBufferPtr = liteRtWasm.WebGPU.importJsBuffer(gpuBuffer), liteRtTensorBuffer = liteRtWasm.LiteRtTensorBuffer.createFromWebGpuBuffer(
      environment.liteRtEnvironment,
      rankedTensorType,
      liteRtWasm.LiteRtTensorBufferType.WEB_GPU_BUFFER_PACKED,
      importedGpuBufferPtr,
      gpuBuffer.size
    );
    return rankedTensorType.delete(), [liteRtTensorBuffer, importedGpuBufferPtr];
  }
  function typedArrayToLiteRtTensorBuffer(data, shape, environment) {
    let globalLiteRt2 = getGlobalLiteRt(), liteRtWasm = globalLiteRt2.liteRtWasm;
    environment = environment ?? globalLiteRt2.getDefaultEnvironment();
    let elementType = getDataType(data).elementType, dimensionsVector = new liteRtWasm.VectorInt32();
    fillEmscriptenVector(shape ?? [data.length], dimensionsVector);
    let layout = liteRtWasm.LiteRtLayout.create(dimensionsVector);
    dimensionsVector.delete();
    let expectedNumElements = layout.numElements();
    if (data.length !== expectedNumElements)
      throw layout.delete(), new Error(
        `Number of elements ${data.length} of the provided TypedArray does not match the expected number of elements ${expectedNumElements}.`
      );
    let rankedTensorType = liteRtWasm.LiteRtRankedTensorType.create(
      { value: elementType },
      layout
    );
    layout.delete();
    let bufferSize = data.constructor.BYTES_PER_ELEMENT * data.length, expectedBufferSize = rankedTensorType.bytes();
    if (bufferSize !== expectedBufferSize)
      throw rankedTensorType.delete(), new Error(
        `Byte length ${bufferSize} of the provided TypedArray does not match the expected buffer size ${expectedBufferSize}.`
      );
    let liteRtTensorBuffer = liteRtWasm.LiteRtTensorBuffer.createManaged(
      environment.liteRtEnvironment,
      liteRtWasm.LiteRtTensorBufferType.HOST_MEMORY,
      rankedTensorType,
      bufferSize
    );
    rankedTensorType.delete();
    let dataPtr = liteRtTensorBuffer.lock(
      liteRtWasm.LiteRtTensorBufferLockMode.WRITE
    );
    try {
      let uint8Data = new Uint8Array(
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
      this.signatureIndex = signatureIndex, this.liteRtModel = liteRtModel, this.liteRtCompiledModel = liteRtCompiledModel, this.options = options, this.liteRtSimpleSignature = liteRtModel.getSignature(signatureIndex);
      let inputNames = emscriptenVectorToArray(this.liteRtSimpleSignature.inputNames()), inputDetails = [];
      for (let i = 0; i < inputNames.length; i++) {
        let name = inputNames[i], tensorType = liteRtModel.getInputTensorType(signatureIndex, i), requirements = liteRtCompiledModel.getInputBufferRequirements(signatureIndex, i);
        inputDetails.push(makeTensorDetails(name, i, tensorType, requirements));
      }
      this.inputDetails = Object.freeze(inputDetails);
      let outputNames = emscriptenVectorToArray(this.liteRtSimpleSignature.outputNames()), outputDetails = [];
      for (let i = 0; i < outputNames.length; i++) {
        let name = outputNames[i], tensorType = liteRtModel.getOutputTensorType(signatureIndex, i), requirements = liteRtCompiledModel.getOutputBufferRequirements(signatureIndex, i);
        outputDetails.push(makeTensorDetails(name, i, tensorType, requirements));
      }
      this.outputDetails = Object.freeze(outputDetails);
    }
    inputDetails;
    outputDetails;
    liteRtSimpleSignature;
    deletedInternal = !1;
    /**
     * The string key corresponding to this signature in the model.
     */
    get key() {
      return this.ensureNotDeleted(), this.liteRtSimpleSignature.key();
    }
    /**
     * Get details about each input tensor.
     */
    getInputDetails() {
      return this.ensureNotDeleted(), this.inputDetails;
    }
    /**
     * Get details about each output tensor.
     */
    getOutputDetails() {
      return this.ensureNotDeleted(), this.outputDetails;
    }
    async run(input) {
      this.ensureNotDeleted();
      let inputArray = this.inputsToArray(input), { inputsOnAccelerator, cleanup } = await this.ensureInputsOnAccelerator(inputArray), outputArray;
      try {
        outputArray = await this.runWithArray(inputsOnAccelerator);
      } finally {
        cleanup();
      }
      return Array.isArray(input) || input instanceof Tensor ? outputArray : this.outputsToRecord(outputArray);
    }
    inputsToArray(input) {
      if (Array.isArray(input)) {
        if (input.length !== this.inputDetails.length)
          throw new Error(
            `run() called with ${input.length} inputs, but signature expects ${this.inputDetails.length} inputs`
          );
        return input;
      }
      if (input instanceof Tensor) {
        if (this.inputDetails.length !== 1)
          throw new Error(
            `run() called with a single tensor, but signature expects ${this.inputDetails.length} inputs`
          );
        return [input];
      }
      let inputArray = [];
      for (let inputDetails of this.inputDetails) {
        if (!(inputDetails.name in input))
          throw new Error(
            `run() called with input record that is missing input ${inputDetails.name} with index ${inputDetails.index}`
          );
        inputArray.push(input[inputDetails.name]);
      }
      return inputArray;
    }
    outputsToRecord(output) {
      let outputRecord = {};
      for (let i = 0; i < this.outputDetails.length; i++)
        outputRecord[this.outputDetails[i].name] = output[i];
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
      let toDelete = [], inputsOnAccelerator = [], inputDetails = this.getInputDetails();
      if (inputs.length !== inputDetails.length)
        throw new Error(`ensureInputsOnAccelerator() called with ${inputs.length} inputs, but signature expects ${inputDetails.length} inputs`);
      for (let i = 0; i < inputs.length; i++) {
        let input = inputs[i], bufferType = input.getBufferType(), supportedBufferTypes = inputDetails[i].supportedBufferTypes;
        if (supportedBufferTypes.size === 0)
          throw new Error(`Tensor ${inputDetails[i].name} with index ${inputDetails[i].index} has no supported buffer types.`);
        if (supportedBufferTypes.has(bufferType))
          inputsOnAccelerator.push(input);
        else {
          let newBufferType = supportedBufferTypes.values().next().value, copy = await input.copyTo(newBufferType);
          toDelete.push(copy), inputsOnAccelerator.push(copy);
        }
      }
      return {
        inputsOnAccelerator,
        cleanup: () => {
          for (let tensor of toDelete)
            tensor.delete();
        }
      };
    }
    async runWithArray(input) {
      for (let i = 0; i < input.length; i++) {
        let inputTensor = input[i], expectedRankedTensorType = this.liteRtModel.getInputTensorType(this.signatureIndex, i), inputRequirements = this.liteRtCompiledModel.getInputBufferRequirements(
          this.signatureIndex,
          i
        );
        getGlobalLiteRt().liteRtWasm.checkTensorBufferCompatible(
          inputTensor.liteRtTensorBuffer,
          expectedRankedTensorType,
          inputRequirements
        ), expectedRankedTensorType.delete(), inputRequirements.delete();
      }
      return (await this.liteRtCompiledModel.run(
        this.signatureIndex,
        input.map((tensor) => tensor.liteRtTensorBuffer)
      )).map(
        (tensorBuffer) => new Tensor(tensorBuffer, this.options.environment)
      );
    }
    get deleted() {
      return this.deletedInternal;
    }
    ensureNotDeleted() {
      if (this.deleted)
        throw new Error(
          "CompiledModelSignatureRunner is deleted and cannot be used."
        );
    }
    delete() {
      this.deletedInternal || (this.deletedInternal = !0, this.liteRtSimpleSignature.delete());
    }
  };
  function makeTensorDetails(name, index, tensorType, requirements) {
    let layout = tensorType.layout(), dimensions = emscriptenVectorToArray(layout.dimensions());
    layout.delete();
    let supportedBufferTypes = new Set(emscriptenVectorToArray(requirements.supportedTypes()).map(({ value }) => value)), details = {
      name,
      index,
      dtype: getDataType(tensorType.elementType().value).dtype,
      shape: new Int32Array(dimensions),
      supportedBufferTypes
    };
    return tensorType.delete(), requirements.delete(), details;
  }
  var CompiledModel = class {
    constructor(model, liteRtCompiledModel, options, onDelete) {
      this.model = model, this.liteRtCompiledModel = liteRtCompiledModel, this.options = options, this.onDelete = onDelete;
      let numSignatures = model.liteRtModel.getNumSignatures(), compiledModelSignatureRunners = {};
      for (let i = 0; i < numSignatures; i++) {
        let compiledModelSignatureRunner = new CompiledModelSignatureRunner(
          i,
          model.liteRtModel,
          liteRtCompiledModel,
          options
        );
        compiledModelSignatureRunners[compiledModelSignatureRunner.key] = compiledModelSignatureRunner;
      }
      this.compiledModelSignatureRunners = Object.freeze(compiledModelSignatureRunners), this.defaultSignature = Object.values(this.signatures)[0], this.key = this.defaultSignature.key;
    }
    defaultSignature;
    compiledModelSignatureRunners;
    key;
    deletedInternal = !1;
    get signatures() {
      return this.ensureNotDeleted(), this.compiledModelSignatureRunners;
    }
    getInputDetails() {
      return this.ensureNotDeleted(), this.defaultSignature.getInputDetails();
    }
    getOutputDetails() {
      return this.ensureNotDeleted(), this.defaultSignature.getOutputDetails();
    }
    async run(inputOrSignatureName, maybeInput) {
      this.ensureNotDeleted();
      let [signature, input] = this.parseRunInputs(inputOrSignatureName, maybeInput);
      return await signature.run(input);
    }
    parseRunInputs(inputOrSignatureName, maybeInput) {
      let signature, input;
      if (typeof inputOrSignatureName == "string") {
        if (signature = this.signatures[inputOrSignatureName], !signature)
          throw new Error(
            `No signature named ${inputOrSignatureName} found in model.`
          );
        if (!maybeInput)
          throw new Error(
            `No input provided for signature ${inputOrSignatureName}`
          );
        input = maybeInput;
      } else
        signature = this.defaultSignature, input = inputOrSignatureName;
      return [signature, input];
    }
    get deleted() {
      return this.deletedInternal;
    }
    ensureNotDeleted() {
      if (this.deleted)
        throw new Error("CompiledModel is deleted and cannot be used.");
    }
    get isFullyAccelerated() {
      return this.ensureNotDeleted(), this.liteRtCompiledModel.isFullyAccelerated();
    }
    delete() {
      if (!this.deletedInternal) {
        this.deletedInternal = !0, this.liteRtCompiledModel.delete(), this.model.delete();
        for (let signatureRunner of Object.values(
          this.compiledModelSignatureRunners
        ))
          signatureRunner.delete();
        this.onDelete();
      }
    }
  };
  async function urlToUint8Array(url) {
    let response = await fetch(url);
    return new Uint8Array(await response.arrayBuffer());
  }
  async function readableStreamDefaultReaderToUint8Array(reader) {
    let byteOffset = 0, array = new Uint8Array(
      1024
      /* arbitrary starting size */
    ), MAX_ARRAY_SIZE = 2e9;
    for (; ; ) {
      let { done, value } = await reader.read();
      if (value) {
        if (array.byteLength < byteOffset + value.byteLength) {
          if (byteOffset + value.byteLength > MAX_ARRAY_SIZE)
            throw new Error(`Model is too large (> ${MAX_ARRAY_SIZE} bytes).`);
          let newArray = new Uint8Array(Math.min(
            MAX_ARRAY_SIZE,
            Math.max(array.byteLength, value.byteLength) * 2
          ));
          newArray.set(array), array = newArray;
        }
        array.set(value, byteOffset), byteOffset += value.byteLength;
      }
      if (done)
        break;
    }
    return array.slice(0, byteOffset);
  }
  var Model = class {
    constructor(liteRtModel, onDelete) {
      this.liteRtModel = liteRtModel, this.onDelete = onDelete;
    }
    delete() {
      this.liteRtModel.delete(), this.onDelete();
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
  ]), WASM_THREADS_CHECK = new Uint8Array([
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
  ]), WASM_FEATURE_VALUES = {
    relaxedSimd: void 0,
    threads: void 0,
    jspi: void 0,
    webnn: void 0
  };
  function isJspiSupported() {
    return "Suspending" in WebAssembly;
  }
  function isWebNnSupported() {
    return typeof navigator < "u" && !!navigator.ml;
  }
  async function tryWasm(wasm) {
    try {
      return await WebAssembly.instantiate(wasm), { supported: !0 };
    } catch (e) {
      return { supported: !1, error: e };
    }
  }
  var WASM_FEATURE_CHECKS = {
    relaxedSimd: () => (WASM_FEATURE_VALUES.relaxedSimd === void 0 && (WASM_FEATURE_VALUES.relaxedSimd = tryWasm(WASM_RELAXED_SIMD_CHECK)), WASM_FEATURE_VALUES.relaxedSimd),
    threads: () => {
      if (WASM_FEATURE_VALUES.threads === void 0)
        try {
          typeof MessageChannel < "u" && new MessageChannel().port1.postMessage(new SharedArrayBuffer(1)), WASM_FEATURE_VALUES.threads = tryWasm(WASM_THREADS_CHECK);
        } catch (e) {
          WASM_FEATURE_VALUES.threads = Promise.resolve({ supported: !1, error: e });
        }
      return WASM_FEATURE_VALUES.threads;
    },
    jspi: () => {
      if (WASM_FEATURE_VALUES.jspi === void 0) {
        let supported = isJspiSupported();
        WASM_FEATURE_VALUES.jspi = Promise.resolve({
          supported,
          error: supported ? void 0 : new Error("JSPI is not supported")
        });
      }
      return WASM_FEATURE_VALUES.jspi;
    },
    webnn: () => {
      if (WASM_FEATURE_VALUES.webnn === void 0) {
        let supported = isWebNnSupported();
        WASM_FEATURE_VALUES.webnn = Promise.resolve({
          supported,
          error: supported ? void 0 : new Error("WebNN is not supported")
        });
      }
      return WASM_FEATURE_VALUES.webnn;
    }
  };
  async function supportsFeature(feature) {
    let check = WASM_FEATURE_CHECKS[feature]?.();
    if (!check)
      throw new Error(`Unknown feature: ${feature}`);
    return (await check).supported;
  }
  async function throwIfFeatureNotSupported(feature) {
    let check = WASM_FEATURE_CHECKS[feature]?.();
    if (!check)
      throw new Error(`Unknown feature: ${feature}`);
    let result = await check;
    if (!result.supported)
      throw result.error;
  }
  function isWebGPUSupported() {
    return !!(typeof globalThis < "u" && globalThis.navigator && globalThis.navigator.gpu);
  }
  function loadAndCompile(model, compileOptions) {
    return getGlobalLiteRt().loadAndCompile(model, compileOptions);
  }
  var LiteRt = class {
    liteRtWasm;
    defaultEnvironment;
    objectsToDelete = /* @__PURE__ */ new Set();
    constructor(wasmModule) {
      this.liteRtWasm = wasmModule, this.liteRtWasm.setupLogging();
    }
    setDefaultEnvironment(environment) {
      this.defaultEnvironment = environment;
    }
    getDefaultEnvironment() {
      if (!this.defaultEnvironment)
        throw new Error("Default environment is not set.");
      return this.defaultEnvironment;
    }
    setWebGpuDevice(device) {
      let oldEnvironment = this.getDefaultEnvironment();
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
      if (typeof model == "string" || model instanceof URL)
        modelData = await urlToUint8Array(model);
      else if (model instanceof Uint8Array)
        modelData = model;
      else if (model instanceof ReadableStreamDefaultReader)
        modelData = await readableStreamDefaultReaderToUint8Array(model);
      else
        throw new Error("Unsupported model type.");
      let environment = compileOptions.environment ?? this.getDefaultEnvironment(), accelerator = compileOptions.accelerator ?? (environment.webGpuDevice ? "webgpu" : "wasm"), isWebGpu = accelerator === "webgpu";
      if (isWebGpu && !environment.webGpuDevice)
        throw new Error(
          "WebGPU was requested but no WebGPU device is set in the environment."
        );
      let filledCompileOptions = fillCompileOptions(
        compileOptions,
        environment,
        this.liteRtWasm.getThreadCount()
      ), ptr = this.liteRtWasm._malloc(modelData.byteLength);
      this.liteRtWasm.HEAPU8.set(modelData, ptr);
      let wasmModel = this.liteRtWasm.loadModel(
        filledCompileOptions.environment.liteRtEnvironment,
        ptr,
        modelData.byteLength
      ), wasmCompiledModel = await this.liteRtWasm.compileModel(
        filledCompileOptions.environment.liteRtEnvironment,
        wasmModel,
        filledCompileOptions
      ), loadedModel = new Model(wasmModel, () => {
        this.liteRtWasm._free(ptr);
      }), compiledModel = new CompiledModel(
        loadedModel,
        wasmCompiledModel,
        filledCompileOptions,
        () => {
          this.objectsToDelete.delete(compiledModel);
        }
      );
      if (this.objectsToDelete.add(compiledModel), (isWebGpu || accelerator === "webnn") && !compiledModel.isFullyAccelerated)
        if (isJspiSupported())
          console.warn(
            `%c[LiteRT]%c Model not fully compiled for ${accelerator}. Partially delegating to WASM execution.`,
            "background: #FFA000; color: black; font-weight: bold; padding: 2px 5px; border-radius: 3px;",
            "font-weight: bold;"
          );
        else {
          console.warn(
            `%c[LiteRT]%c Model not fully compiled for ${accelerator} on non-JSPI browser. Falling back to WASM execution.`,
            "background: #D32F2F; color: white; font-weight: bold; padding: 2px 5px; border-radius: 3px;",
            "color: #D32F2F; font-weight: bold;"
          ), compiledModel.delete();
          let fallbackCompileOptions = {
            ...compileOptions,
            accelerator: "wasm"
          };
          return this.loadAndCompile(modelData, fallbackCompileOptions);
        }
      return compiledModel;
    }
    delete() {
      for (let object of this.objectsToDelete)
        object.delete();
    }
  };
  function appendPathSegment(path, segment) {
    if (!path) return segment;
    if (!segment) return path;
    let pathWithSlash = path.endsWith("/") ? path : path + "/", segmentWithoutSlash = segment.startsWith("/") ? segment.substring(1) : segment;
    return pathWithSlash + segmentWithoutSlash;
  }
  var WASM_JS_FILE_NAME = "litert_wasm_internal.js", WASM_JS_COMPAT_FILE_NAME = "litert_wasm_compat_internal.js", WASM_JS_THREADED_FILE_NAME = "litert_wasm_threaded_internal.js", WASM_JS_JSPI_FILE_NAME = "litert_wasm_jspi_internal.js";
  async function load(path, options) {
    let pathString = path, isFullFilePath = pathString.endsWith(".wasm") || pathString.endsWith(".js"), relaxedSimd = await supportsFeature("relaxedSimd");
    if (options?.threads) {
      if (options?.jspi)
        throw new Error(
          "The `threads` and `jspi` options are mutually exclusive."
        );
      if (isFullFilePath && console.warn(
        `The \`threads\` option was specified, but the wasm path ${pathString} is a full file path. Whether threads are available or not will depend on the loaded file. To allow LiteRT.js to load the threaded wasm file, use a directory path instead of a full file path.`
      ), !relaxedSimd)
        throw new Error(
          "Threads are only supported with relaxed SIMD, and the current browser does not support relaxed SIMD."
        );
      await throwIfFeatureNotSupported("threads");
    }
    options?.jspi && (isFullFilePath && console.warn(
      `The \`jspi\` option was specified, but the wasm path ${pathString} is a full file path. Whether JSPI is available or not will depend on the loaded file. To allow LiteRT.js to load the JSPI wasm file, use a directory path instead of a full file path.`
    ), await throwIfFeatureNotSupported("jspi"));
    let fileName = WASM_JS_COMPAT_FILE_NAME;
    relaxedSimd && (options?.threads ? fileName = WASM_JS_THREADED_FILE_NAME : options?.jspi ? fileName = WASM_JS_JSPI_FILE_NAME : fileName = WASM_JS_FILE_NAME);
    let jsFilePath = path;
    if (pathString.endsWith(".wasm"))
      throw new Error(
        "Please load the `.js` file corresponding to the `.wasm` file, or load the directory containing it."
      );
    return pathString.endsWith(".js") || (jsFilePath = appendPathSegment(path, fileName)), createWasmLib(LiteRt, jsFilePath);
  }
  function loadLiteRt(path, options) {
    if (hasGlobalLiteRtPromise())
      throw new Error("LiteRT is already loading / loaded.");
    return setGlobalLiteRtPromise(load(path, options).then(async (liteRt) => (setGlobalLiteRt(liteRt), liteRt.setDefaultEnvironment(
      await Environment.create()
    ), liteRt)).catch((error2) => {
      throw setGlobalLiteRtPromise(void 0), error2;
    })), getGlobalLiteRtPromise();
  }
  var compilationLock = Promise.resolve();
  async function copyHostMemoryToHostMemory(cpuTensor, options = {}) {
    let environment = options.environment ?? cpuTensor.environment, liteRtWasm = getGlobalLiteRt().liteRtWasm, srcTensorBuffer = cpuTensor.liteRtTensorBuffer;
    if (srcTensorBuffer.bufferType().value !== TensorBufferType.HOST_MEMORY)
      throw new Error(
        "Source tensor is not in host memory. Cannot copy to host memory."
      );
    let srcTensorMemoryPtr = srcTensorBuffer.lock(
      liteRtWasm.LiteRtTensorBufferLockMode.READ
    ), destTensorBuffer;
    try {
      destTensorBuffer = liteRtWasm.LiteRtTensorBuffer.createManaged(
        environment.liteRtEnvironment,
        liteRtWasm.LiteRtTensorBufferType.HOST_MEMORY,
        srcTensorBuffer.tensorType(),
        srcTensorBuffer.size()
      );
      let destMemoryPointer = destTensorBuffer.lock(
        liteRtWasm.LiteRtTensorBufferLockMode.WRITE
      );
      try {
        let srcTensorMemoryView = new Uint8Array(
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
    if (!destTensorBuffer)
      throw new Error("Failed to create destination tensor buffer.");
    return new Tensor(destTensorBuffer, environment);
  }
  async function cpuTensorToGpuTensor(cpuTensor, options = {}) {
    let environment = options.environment ?? cpuTensor.environment, device = environment.webGpuDevice;
    if (!device)
      throw new Error(
        "No WebGPU device is available. Did you forget to pass a destination environment that has a WebGPU device?"
      );
    let liteRtWasm = getGlobalLiteRt().liteRtWasm, paddedByteLength = cpuTensor.liteRtTensorBuffer.size() + 3 & -4, stagingBuffer = device.createBuffer({
      size: paddedByteLength,
      usage: GPUBufferUsage.MAP_WRITE | GPUBufferUsage.COPY_SRC,
      mappedAtCreation: !0
    }), mappedBuffer = await stagingBuffer.getMappedRange(), mappedArray = new Uint8Array(mappedBuffer), cpuMemoryPtr = cpuTensor.liteRtTensorBuffer.lock(
      liteRtWasm.LiteRtTensorBufferLockMode.READ
    );
    try {
      let cpuMemoryView = new Uint8Array(
        liteRtWasm.HEAPU8.buffer,
        cpuMemoryPtr,
        cpuTensor.liteRtTensorBuffer.size()
      );
      mappedArray.set(cpuMemoryView);
    } finally {
      cpuTensor.liteRtTensorBuffer.unlock();
    }
    stagingBuffer.unmap();
    let buffer = device.createBuffer({
      size: paddedByteLength,
      usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE
    }), commandEncoder = device.createCommandEncoder();
    return commandEncoder.copyBufferToBuffer(
      stagingBuffer,
      0,
      buffer,
      0,
      paddedByteLength
    ), device.queue.submit([commandEncoder.finish()]), stagingBuffer.destroy(), new Tensor(
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
    let environment = options.environment ?? gpuTensor.environment, device = gpuTensor.environment.webGpuDevice;
    if (!device)
      throw new Error(
        "No WebGPU device is available. Does the source tensor have a WebGPU device?"
      );
    let liteRtWasm = getGlobalLiteRt().liteRtWasm, tensorBuffer = gpuTensor.liteRtTensorBuffer, bufferType = tensorBuffer.bufferType();
    if (bufferType !== liteRtWasm.LiteRtTensorBufferType.WEB_GPU_BUFFER_PACKED)
      throw new Error(`Cannot convert a tensor with a non-WebGPU buffer type ${bufferType} to a CPU tensor.`);
    let gpuBuffer = liteRtWasm.WebGPU.getJsObject(
      tensorBuffer.getWebGpuBuffer()
    ), byteOffset = tensorBuffer.offset(), tensorType = tensorBuffer.tensorType(), layout = tensorType.layout(), numElements = layout.numElements(), arrayConstructor = getDataType(tensorType.elementType().value).typedArrayConstructor;
    layout.delete(), tensorType.delete();
    let mappableBuffer = gpuBuffer, cleanupBuffer = () => {
    };
    if (!(gpuBuffer.usage & GPUBufferUsage.MAP_READ)) {
      mappableBuffer = device.createBuffer({
        size: gpuBuffer.size,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
      }), cleanupBuffer = () => {
        mappableBuffer.destroy();
      };
      let commandEncoder = device.createCommandEncoder();
      commandEncoder.copyBufferToBuffer(
        gpuBuffer,
        0,
        mappableBuffer,
        0,
        gpuBuffer.size
      ), device.queue.submit([commandEncoder.finish()]);
    }
    await mappableBuffer.mapAsync(GPUMapMode.READ);
    let mappedBuffer = mappableBuffer.getMappedRange(), mappedArray = new arrayConstructor(mappedBuffer, byteOffset, numElements), cpuTensor = new Tensor(mappedArray, gpuTensor.type.layout.dimensions, environment);
    return mappableBuffer.unmap(), cleanupBuffer(), cpuTensor;
  }
  function makeMoveTo(copyTo) {
    return async (tensor, options) => {
      let result = await copyTo(tensor, options);
      return tensor.delete(), result;
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
    ])), Tensor.copyFunctions.set(TensorBufferType.WEB_GPU_BUFFER_PACKED, /* @__PURE__ */ new Map([
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

  // src-ocr/ocr-pipeline.js
  var IMAGENET_MEAN = [0.485, 0.456, 0.406], IMAGENET_STD = [0.229, 0.224, 0.225];
  function detPreprocess(rgba, srcW, srcH) {
    let nchw = new Float32Array(1228800);
    for (let i = 0; i < 409600; i++)
      for (let c = 0; c < 3; c++)
        nchw[c * 409600 + i] = (rgba[i * 4 + c] / 255 - IMAGENET_MEAN[c]) / IMAGENET_STD[c];
    return { nchw, scaleX: srcW / 640, scaleY: srcH / 640 };
  }
  function probToBoxes(prob, { thresh = 0.3, minScore = 0.5, minSize = 3 } = {}) {
    let labels = new Int32Array(409600), comps = [], stack = new Int32Array(640 * 640);
    for (let i = 0; i < 640 * 640; i++) {
      if (labels[i] !== 0 || prob[i] <= thresh) continue;
      let label = comps.length + 1, top = 0;
      stack[top++] = i, labels[i] = label;
      let minX = 640, minY = 640, maxX = 0, maxY = 0, sum = 0, count = 0;
      for (; top > 0; ) {
        let p = stack[--top], x = p % 640, y = p / 640 | 0;
        x < minX && (minX = x), x > maxX && (maxX = x), y < minY && (minY = y), y > maxY && (maxY = y), sum += prob[p], count++, x > 0 && labels[p - 1] === 0 && prob[p - 1] > thresh && (labels[p - 1] = label, stack[top++] = p - 1), x < 639 && labels[p + 1] === 0 && prob[p + 1] > thresh && (labels[p + 1] = label, stack[top++] = p + 1), y > 0 && labels[p - 640] === 0 && prob[p - 640] > thresh && (labels[p - 640] = label, stack[top++] = p - 640), y < 639 && labels[p + 640] === 0 && prob[p + 640] > thresh && (labels[p + 640] = label, stack[top++] = p + 640);
      }
      comps.push({ minX, minY, maxX, maxY, score: sum / count });
    }
    let boxes = [];
    for (let c of comps) {
      let w = c.maxX - c.minX + 1, h = c.maxY - c.minY + 1;
      if (w < minSize || h < minSize || c.score < minScore) continue;
      let pad = Math.min(40, Math.max(2, Math.round(1.5 * w * h / (2 * (w + h)))));
      boxes.push({
        x0: Math.max(0, c.minX - pad),
        y0: Math.max(0, c.minY - pad),
        x1: Math.min(639, c.maxX + pad),
        y1: Math.min(639, c.maxY + pad),
        score: c.score
      });
    }
    boxes.sort((a, b) => a.x0 - b.x0);
    let merged = !0;
    for (; merged; ) {
      merged = !1;
      for (let i = 0; i < boxes.length && !merged; i++)
        for (let j = i + 1; j < boxes.length; j++) {
          let a = boxes[i], b = boxes[j], ha = a.y1 - a.y0, hb = b.y1 - b.y0;
          if (!(Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) < 0.5 * Math.min(ha, hb) || Math.max(a.x0, b.x0) - Math.min(a.x1, b.x1) > 1.2 * Math.min(ha, hb))) {
            boxes[i] = {
              x0: Math.min(a.x0, b.x0),
              y0: Math.min(a.y0, b.y0),
              x1: Math.max(a.x1, b.x1),
              y1: Math.max(a.y1, b.y1),
              score: (a.score + b.score) / 2
            }, boxes.splice(j, 1), merged = !0;
            break;
          }
        }
    }
    return boxes.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0), boxes;
  }
  function columnInkProfile(rgba, w, h) {
    let br = 0, bg_ = 0, bb = 0, n = 0;
    for (let [cx, cy] of [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]])
      for (let d = 0; d < 3; d++) {
        let x = Math.min(w - 1, Math.max(0, cx + (cx === 0 ? d : -d))), i = (cy * w + x) * 4;
        br += rgba[i], bg_ += rgba[i + 1], bb += rgba[i + 2], n++;
      }
    br /= n, bg_ /= n, bb /= n;
    let profile = new Float32Array(w);
    for (let x = 0; x < w; x++) {
      let m = 0;
      for (let y = 0; y < h; y++) {
        let i = (y * w + x) * 4, d = Math.abs(rgba[i] - br) + Math.abs(rgba[i + 1] - bg_) + Math.abs(rgba[i + 2] - bb);
        d > m && (m = d);
      }
      profile[x] = m;
    }
    return { profile, bg: [Math.round(br), Math.round(bg_), Math.round(bb)] };
  }
  function splitByInk(profile, lw, { maxW = 320, squashLimit = 320 * 2.2, gapFrac = 0.06 } = {}) {
    if (lw <= maxW) return [{ from: 0, to: lw }];
    let peak = 0;
    for (let x = 0; x < lw; x++) profile[x] > peak && (peak = profile[x]);
    let low = Math.max(12, peak * gapFrac), pieces = [], start = 0;
    for (; ; ) {
      let remaining = lw - start;
      if (remaining <= squashLimit) {
        pieces.push({ from: start, to: lw });
        break;
      }
      let from = start + Math.round(maxW * 0.55), until = start + maxW, bestRunStart = -1, bestRunLen = 0, runStart = -1;
      for (let x = from; x <= until + 1; x++) {
        let isLow = x <= until && x < lw && profile[x] <= low;
        isLow && runStart < 0 && (runStart = x), !isLow && runStart >= 0 && (x - runStart > bestRunLen && (bestRunLen = x - runStart, bestRunStart = runStart), runStart = -1);
      }
      if (bestRunLen >= 2) {
        let cut = bestRunStart + (bestRunLen >> 1);
        pieces.push({ from: start, to: cut }), start = cut;
      } else if (remaining <= squashLimit) {
        pieces.push({ from: start, to: lw });
        break;
      } else {
        let end = Math.min(lw, start + squashLimit);
        for (let x = end; x >= start + maxW; x--)
          if (profile[x] <= low) {
            end = x;
            break;
          }
        pieces.push({ from: start, to: end }), start = end;
      }
      if (start >= lw - 2) break;
    }
    return pieces;
  }
  function widestInteriorGap(profile, from, to) {
    let w = to - from, a = from + Math.round(w * 0.15), b = to - Math.round(w * 0.15), peak = 0;
    for (let x = from; x < to; x++) profile[x] > peak && (peak = profile[x]);
    let low = Math.max(12, peak * 0.06), bestStart = -1, bestLen = 0, runStart = -1;
    for (let x = a; x <= b; x++) {
      let isLow = x < b && profile[x] <= low;
      isLow && runStart < 0 && (runStart = x), !isLow && runStart >= 0 && (x - runStart > bestLen && (bestLen = x - runStart, bestStart = runStart), runStart = -1);
    }
    return bestLen < 2 ? null : bestStart + (bestLen >> 1);
  }
  function inkBounds(profile, from, to, margin = 4) {
    let peak = 0;
    for (let x = from; x < to; x++) profile[x] > peak && (peak = profile[x]);
    let low = Math.max(12, peak * 0.06), a = -1, b = -1;
    for (let x = from; x < to; x++)
      profile[x] > low && (a < 0 && (a = x), b = x);
    return a < 0 ? null : { from: Math.max(from, a - margin), to: Math.min(to, b + 1 + margin) };
  }
  function recPreprocess(rgba, contentW) {
    let nchw = new Float32Array(46080).fill(-1);
    for (let y = 0; y < 48; y++)
      for (let x = 0; x < contentW; x++) {
        let src = (y * contentW + x) * 4, dst = y * 320 + x;
        nchw[dst] = rgba[src] / 255 / 0.5 - 1, nchw[15360 + dst] = rgba[src + 1] / 255 / 0.5 - 1, nchw[2 * 15360 + dst] = rgba[src + 2] / 255 / 0.5 - 1;
      }
    return nchw;
  }
  function ctcDecode(logits, T, C, chars2) {
    let ids = new Int32Array(T), marginSum = 0, marginN = 0;
    for (let t = 0; t < T; t++) {
      let off = t * C, best = 0, bestV = logits[off], second = -1 / 0;
      for (let c = 1; c < C; c++) {
        let v = logits[off + c];
        v > bestV ? (second = bestV, bestV = v, best = c) : v > second && (second = v);
      }
      ids[t] = best, best !== 0 && (marginSum += bestV - second, marginN++);
    }
    let text = "";
    for (let t = 0; t < T; t++) {
      let c = ids[t];
      c !== 0 && (t === 0 || c !== ids[t - 1]) && (text += chars2[c] ?? "");
    }
    return { text, ids: Array.from(ids), score: marginN ? marginSum / marginN : 0 };
  }
  function buildCharTable(dictText) {
    let lines = dictText.split(`
`);
    return lines[lines.length - 1] === "" && lines.pop(), ["", ...lines, " "];
  }

  // src-ocr/offscreen/main.js
  var HF = "https://huggingface.co/litert-community/PP-OCRv5-LiteRT/resolve/main", DET_URL = `${HF}/ppocr_det_fp16.tflite`, REC_URL = `${HF}/ppocr_rec_fp32.tflite`, DICT_URL = `${HF}/ppocrv5_dict.txt`, CACHE_NAME = "pagetext-models-v1", CACHE_ENTRIES = 8, MIN_LINE_CHARS = 1, SCORE_MIN = 0.2, EDGE_PAD = 8, state = "loading", error = null, detBackend = null, wasmOpts = null, detModel = null, recModel = null, chars = null, downloadedMB = 0, lastStats = null, runCount = 0, lastResult = null, resultCache = /* @__PURE__ */ new Map();
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!(!msg || msg.target !== "offscreen"))
      return msg.type === "ocr" ? (requestOcr(msg.url, { background: !!msg.background }).then(sendResponse), !0) : (msg.type === "status" && sendResponse(statusPayload()), !1);
  });
  function statusPayload() {
    return {
      target: "ui",
      type: "status",
      state,
      error,
      env: detBackend ? `det ${detBackend} \xB7 rec wasm` : null,
      flags: {
        webgpu: detBackend ? detBackend === "webgpu" : null,
        threads: wasmOpts?.threads ?? null,
        crossOriginIsolated: globalThis.crossOriginIsolated
      },
      stats: lastStats,
      downloadedMB,
      runs: runCount
    };
  }
  var lastBroadcast = 0;
  function broadcast(force = !1) {
    let now = performance.now();
    !force && now - lastBroadcast < 250 || (lastBroadcast = now, chrome.runtime.sendMessage(statusPayload()).catch(() => {
    }));
  }
  async function fetchCached(url, onProgress) {
    let cache = "caches" in globalThis ? await caches.open(CACHE_NAME) : null;
    if (cache) {
      let hit = await cache.match(url);
      if (hit) return new Uint8Array(await hit.arrayBuffer());
    }
    let response = await fetch(url);
    if (!response.ok) throw new Error(`model download: HTTP ${response.status}`);
    let reader = response.body.getReader(), chunks = [], received = 0;
    for (; ; ) {
      let { done, value } = await reader.read();
      if (done) break;
      chunks.push(value), received += value.length, onProgress?.(received);
    }
    let bytes = new Uint8Array(received), offset = 0;
    for (let chunk of chunks)
      bytes.set(chunk, offset), offset += chunk.length;
    return cache && await cache.put(url, new Response(bytes.slice().buffer)), bytes;
  }
  async function boot() {
    try {
      let attempts = [
        { threads: globalThis.crossOriginIsolated },
        { threads: !1 }
      ], loaded = !1, lastErr = null;
      for (let opts of attempts)
        try {
          await loadLiteRt("litert-wasm/", opts), wasmOpts = opts, loaded = !0;
          break;
        } catch (err) {
          lastErr = err;
        }
      if (!loaded) throw lastErr;
      state = "downloading", broadcast(!0);
      let base = 0, progress = (received) => {
        downloadedMB = Math.round((base + received) / 1048576), broadcast();
      }, detBytes = await fetchCached(DET_URL, progress);
      base += detBytes.length;
      let recBytes = await fetchCached(REC_URL, progress);
      base += recBytes.length;
      let dictBytes = await fetchCached(DICT_URL, progress);
      chars = buildCharTable(new TextDecoder().decode(dictBytes)), state = "compiling", broadcast(!0);
      let wasmCompile = { accelerator: "wasm", cpuOptions: { numThreads: Math.min(8, navigator.hardwareConcurrency || 4) } };
      if (recModel = await loadAndCompile(recBytes, wasmCompile), detBackend = isWebGPUSupported() ? "webgpu" : "wasm", detBackend === "wasm")
        detModel = await loadAndCompile(detBytes, wasmCompile);
      else
        try {
          detModel = await loadAndCompile(detBytes, { accelerator: "webgpu" });
        } catch {
          detBackend = "wasm", detModel = await loadAndCompile(detBytes, wasmCompile);
        }
      state = "ready", broadcast(!0);
    } catch (err) {
      state = "error", error = String(err instanceof Error ? err.message : err), broadcast(!0);
    }
  }
  async function fetchImageBytes(url, { forceRelay = !1 } = {}) {
    let t0 = performance.now();
    if (!forceRelay)
      try {
        let response = await fetch(url, { credentials: "omit" });
        if (response.ok)
          return { bytes: new Uint8Array(await response.arrayBuffer()), via: "offscreen", fetchMs: performance.now() - t0 };
      } catch {
      }
    let relay = await chrome.runtime.sendMessage({ target: "bg", type: "fetch-image", url });
    if (!relay?.ok) throw new Error(`fetch failed: ${relay?.error ?? "no relay response"}`);
    let bin = atob(relay.b64), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { bytes, via: "sw-relay", fetchMs: performance.now() - t0 };
  }
  async function runModel(model, nchw, shape) {
    let input = Tensor.fromTypedArray(nchw, shape), start = performance.now(), outputs = await model.run([input]), data = await outputs[0].data(), ms = performance.now() - start;
    for (let output of outputs) output.delete();
    return input.delete(), { data, ms };
  }
  var detCanvas = new OffscreenCanvas(640, 640), detCtx = detCanvas.getContext("2d", { willReadFrequently: !0 });
  async function recognizeWindow(strip, from, pw, bg, maxVariants = 5) {
    let C = chars.length, variants = [
      { pad: EDGE_PAD, scale: 1, grow: 0 },
      // Short crops left at native scale sit in a pocket: a clean "Notes for"
      // (203 px of a 304 px window) decoded as "Yotesow" at margin 0.15, and
      // stretching the same pixels to fill the window read it correctly at
      // 0.95. Capped at 2.5× so a one-word crop is not smeared.
      { pad: EDGE_PAD, scale: 1, grow: 0, fill: !0 },
      { pad: EDGE_PAD + 10, scale: 0.92, grow: 0 },
      { pad: EDGE_PAD, scale: 0.96, grow: 10 },
      // widened bounds: new context
      { pad: EDGE_PAD + 4, scale: 0.85, grow: 0 },
      { pad: EDGE_PAD, scale: 1, grow: 22 }
    ].slice(0, maxVariants), best = null, ms = 0;
    for (let v of variants) {
      let f = Math.max(0, from - v.grow), w = Math.min(strip.width - f, pw + v.grow + (from - f)), availW = 320 - 2 * v.pad, natW = Math.round(w * v.scale), drawnW = v.fill ? Math.min(availW, Math.round(natW * 2.5)) : Math.min(availW, natW), drawnH = Math.round(48 * v.scale), contentW = Math.min(320, drawnW + 2 * v.pad), ctx = new OffscreenCanvas(contentW, 48).getContext("2d", { willReadFrequently: !0 });
      ctx.fillStyle = `rgb(${bg[0]},${bg[1]},${bg[2]})`, ctx.fillRect(0, 0, contentW, 48), ctx.drawImage(
        strip,
        f,
        0,
        w,
        48,
        v.pad,
        Math.floor((48 - drawnH) / 2),
        drawnW,
        drawnH
      );
      let rgba = ctx.getImageData(0, 0, contentW, 48).data, rec = await runModel(recModel, recPreprocess(rgba, contentW), [1, 3, 48, 320]);
      ms += rec.ms;
      let d = ctcDecode(rec.data, rec.data.length / C, C, chars);
      if ((!best || d.score > best.score) && (best = d), best.score >= 0.85) break;
    }
    return { text: best.text, score: best.score, ms };
  }
  var CJK_RE = /[぀-ヿ㐀-䶿一-鿿]/;
  async function recognizePiece(strip, profile, from, to, bg, depth = 0) {
    let pw = to - from, r = await recognizeWindow(strip, from, pw, bg, depth === 0 ? 6 : 2);
    if (r.score >= 0.75 || depth >= 2 || pw < 60) return r;
    let cut = widestInteriorGap(profile, from, to);
    if (cut == null) return r;
    let left = await recognizePiece(strip, profile, from, cut, bg, depth + 1), right = await recognizePiece(strip, profile, cut, to, bg, depth + 1), combinedScore = Math.min(left.score, right.score);
    if (combinedScore <= r.score) return { ...r, ms: r.ms + left.ms + right.ms };
    let sep = !left.text || !right.text || CJK_RE.test(left.text.slice(-1)) && CJK_RE.test(right.text[0]) ? "" : " ";
    return {
      text: left.text + sep + right.text,
      score: combinedScore,
      ms: r.ms + left.ms + right.ms
    };
  }
  async function runOcr(url, { forceRelay = !1 } = {}) {
    if (state !== "ready") {
      let deadline = Date.now() + 3e5;
      for (; state !== "ready" && state !== "error" && Date.now() < deadline; )
        await new Promise((r) => setTimeout(r, 300));
      if (state !== "ready") return { ok: !1, error: error ?? "engine not ready" };
    }
    let cached = resultCache.get(url);
    if (cached && !forceRelay)
      return resultCache.delete(url), resultCache.set(url, cached), cached;
    if (!forceRelay) {
      let stored = await dbGet(url);
      if (stored)
        return resultCache.set(url, stored), stored;
    }
    let { bytes, via, fetchMs } = await fetchImageBytes(url, { forceRelay }), bitmap = await createImageBitmap(new Blob([bytes]), { imageOrientation: "from-image" }), nw = bitmap.width, nh = bitmap.height;
    detCtx.drawImage(bitmap, 0, 0, nw, nh, 0, 0, 640, 640);
    let rgba = detCtx.getImageData(0, 0, 640, 640).data, { nchw, scaleX, scaleY } = detPreprocess(rgba, nw, nh), det = await runModel(detModel, nchw, [1, 3, 640, 640]), boxes = probToBoxes(det.data), lines = [], recMs = 0;
    for (let [group, box] of boxes.entries()) {
      let sx = box.x0 * scaleX, sy = box.y0 * scaleY, sw = (box.x1 - box.x0 + 1) * scaleX, sh = (box.y1 - box.y0 + 1) * scaleY, lw = Math.min(4096, Math.max(1, Math.round(48 * (sw / sh)))), strip = new OffscreenCanvas(lw, 48), stripCtx = strip.getContext("2d", { willReadFrequently: !0 });
      stripCtx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, lw, 48);
      let stripRgba = stripCtx.getImageData(0, 0, lw, 48).data, { profile, bg } = columnInkProfile(stripRgba, lw, 48), pieces = splitByInk(profile, lw, {
        maxW: 320 - 2 * EDGE_PAD,
        squashLimit: (320 - 2 * EDGE_PAD) * 2.2
      });
      for (let piece of pieces) {
        let tight = inkBounds(profile, piece.from, piece.to);
        if (!tight) continue;
        let { from, to } = tight, pw = to - from;
        if (pw < 3) continue;
        let best = await recognizePiece(strip, profile, from, to, bg);
        recMs += best.ms;
        let { text, score } = best;
        if (text.trim().length < MIN_LINE_CHARS || score < SCORE_MIN) continue;
        let toSrc = sh / 48;
        lines.push({
          x: (sx + from * toSrc) / nw,
          y: sy / nh,
          w: pw * toSrc / nw,
          h: sh / nh,
          text,
          score: +score.toFixed(3),
          group
          // pieces of one detected line share a group → joined on copy
        });
      }
    }
    bitmap.close(), runCount++, lastStats = {
      fetchMs: +fetchMs.toFixed(0),
      detMs: +det.ms.toFixed(0),
      recMs: +recMs.toFixed(0),
      lineCount: lines.length,
      via
    }, broadcast(!0);
    let payload = { ok: !0, natural: { w: nw, h: nh }, lines, stats: { ...lastStats } };
    return lastResult = payload, resultCache.set(url, payload), dbPut(url, payload), resultCache.size > CACHE_ENTRIES && resultCache.delete(resultCache.keys().next().value), payload;
  }
  var DB_NAME = "pagetext-index", STORE = "reads", dbPromise = null;
  function openDb() {
    return dbPromise ??= new Promise((resolve) => {
      let req;
      try {
        req = indexedDB.open(DB_NAME, 1);
      } catch {
        resolve(null);
        return;
      }
      req.onupgradeneeded = () => req.result.createObjectStore(STORE), req.onsuccess = () => resolve(req.result), req.onerror = () => resolve(null);
    }), dbPromise;
  }
  async function dbGet(url) {
    let db = await openDb();
    return db ? new Promise((resolve) => {
      let req = db.transaction(STORE, "readonly").objectStore(STORE).get(url);
      req.onsuccess = () => resolve(req.result ?? null), req.onerror = () => resolve(null);
    }) : null;
  }
  async function dbPut(url, payload) {
    let db = await openDb();
    if (db)
      try {
        db.transaction(STORE, "readwrite").objectStore(STORE).put(payload, url);
      } catch {
      }
  }
  var lanes = { fg: [], bg: [] }, pumping = !1;
  function requestOcr(url, opts = {}) {
    return new Promise((resolve) => {
      lanes[opts.background ? "bg" : "fg"].push({ url, opts, resolve }), pump();
    });
  }
  async function pump() {
    if (!pumping) {
      for (pumping = !0; ; ) {
        let job = lanes.fg.shift() ?? lanes.bg.shift();
        if (!job) break;
        let out;
        try {
          out = await runOcr(job.url, job.opts);
        } catch (err) {
          out = { ok: !1, error: String(err instanceof Error ? err.message : err) };
        }
        job.resolve(out);
      }
      pumping = !1;
    }
  }
  boot();
})();
