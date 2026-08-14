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

  // src/offscreen/g2p.js
  var TOKEN = /[a-z']+|\d+(?:\.\d+)?|[.,!?;:—…"]/g, WORD = /^[a-z']+$/, ONES = [
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
  ], TENS = [
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
    for (let [div, name] of [[1e9, "billion"], [1e6, "million"], [1e3, "thousand"]])
      if (n >= div)
        return intToWords(Math.floor(n / div)) + " " + name + (n % div ? " " + intToWords(n % div) : "");
    return ONES[0];
  }
  function numberToWords(tok) {
    let [int, frac] = tok.split("."), out = int.length > 12 ? [...int].map((d) => ONES[+d]).join(" ") : intToWords(parseInt(int, 10));
    return frac !== void 0 && (out += " point " + [...frac].map((d) => ONES[+d]).join(" ")), out;
  }
  var G2P = class {
    /**
     * @param dict Map<string,string> word → espeak-IPA
     * @param meta g2p_meta.json contents
     * @param model dp_g2p compiled model (WASM) or null (dictionary-only)
     */
    constructor(dict, meta, model) {
      this.dict = dict, this.meta = meta, this.model = model, this.special = new Set(meta.special), this.cache = /* @__PURE__ */ new Map();
    }
    async wordToIpa(word) {
      let hit = this.dict.get(word);
      if (hit !== void 0) return hit;
      let ipa = this.cache.get(word);
      return ipa === void 0 && (ipa = this.model ? await this.neural(word) : "", this.cache.set(word, ipa)), ipa;
    }
    async neural(word) {
      let { char2idx, idx2ph, char_repeats: rep, start, end, MAXT, n_phonemes: nph } = this.meta, ids = [start];
      for (let ch of word) {
        let id = char2idx[ch];
        if (id !== void 0) for (let r = 0; r < rep; r++) ids.push(id);
      }
      ids.push(end);
      let L = Math.min(ids.length, MAXT), input = new Float32Array(MAXT);
      for (let i = 0; i < L; i++) input[i] = ids[i];
      let inT = Tensor.fromTypedArray(input, [1, MAXT]), outs = await this.model.run([inT]), logits = await outs[0].data();
      for (let o of outs) o.delete();
      inT.delete();
      let prev = -1, out = "";
      for (let pos = 0; pos < L; pos++) {
        let best = 0, bestV = -1 / 0;
        for (let k = 0; k < nph; k++) {
          let v = logits[pos * nph + k];
          v > bestV && (bestV = v, best = k);
        }
        if (best === prev) continue;
        prev = best;
        let ph = idx2ph[best];
        best === 0 || ph === void 0 || this.special.has(ph) || (out += ph.replaceAll("-", ""));
      }
      return out;
    }
  };
  async function phonemize(g2p2, symToId2, text, maxPids = 127) {
    let spaceId = symToId2.get(" "), pieces = [];
    for (let m of text.toLowerCase().matchAll(TOKEN)) {
      let tok = m[0], words = null;
      if (/^\d/.test(tok) ? words = numberToWords(tok).split(" ") : WORD.test(tok) && (words = [tok]), words)
        for (let w of words) {
          let ipa = await g2p2.wordToIpa(w);
          if (!ipa) continue;
          let ids = [];
          for (let ch of ipa) {
            let id = symToId2.get(ch);
            id !== void 0 && ids.push(id);
          }
          ids.length && pieces.push({ ids, ipa, isWord: !0, sentenceEnd: !1 });
        }
      else {
        let norm = tok === "!" ? "." : tok, id = symToId2.get(norm);
        id !== void 0 && pieces.push({ ids: [id], ipa: norm, isWord: !1, sentenceEnd: /[.!?…]/.test(norm) });
      }
    }
    let chunks = [], cur = { ids: [], ipa: "" }, flush = () => {
      cur.ids.length && chunks.push(cur), cur = { ids: [], ipa: "" };
    };
    for (let p of pieces) {
      let sep = p.isWord && cur.ids.length ? 1 : 0;
      cur.ids.length + sep + p.ids.length > maxPids && flush(), p.isWord && cur.ids.length && (cur.ids.push(spaceId), cur.ipa += " "), cur.ids.push(...p.ids), cur.ipa += p.ipa, p.sentenceEnd && flush();
    }
    return flush(), chunks;
  }

  // src/offscreen/synth.js
  function makeRandn(seed) {
    let s = seed >>> 0, uniform = () => {
      s = s + 1831565813 | 0;
      let t = Math.imul(s ^ s >>> 15, 1 | s);
      return t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t, ((t ^ t >>> 14) >>> 0) / 4294967296;
    }, spare = null;
    return () => {
      if (spare !== null) {
        let v = spare;
        return spare = null, v;
      }
      let a = 0;
      for (; a === 0; ) a = uniform();
      let r = Math.sqrt(-2 * Math.log(a)), th = 2 * Math.PI * uniform();
      return spare = r * Math.sin(th), r * Math.cos(th);
    };
  }
  function sinPosEmb(t, dim) {
    let half = dim / 2, out = new Float32Array(dim), k = -Math.log(1e4) / (half - 1);
    for (let i = 0; i < half; i++) {
      let e = 1e3 * t * Math.exp(i * k);
      out[i] = Math.sin(e), out[half + i] = Math.cos(e);
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
      this.m = models, this.emb = emb, this.cfg = cfg2;
    }
    /**
     * @param pids symbol ids (≤ (MAX_TEXT-1)/2)
     * @returns {wav, ylen, mel, timings} — wav trimmed+clipped, mel [80×MAX_MEL]
     */
    async run(pids, { steps = 10, seed = 0 } = {}) {
      let {
        MAX_TEXT,
        MAX_MEL,
        n_feats: F,
        n_channels: CH,
        hop,
        mel_mean,
        mel_std,
        length_scale,
        in_channels: TDIM
      } = this.cfg, timings = { textenc: 0, decoder: 0, vocoder: 0 }, embx = new Float32Array(MAX_TEXT * CH);
      for (let t = 0; t < MAX_TEXT; t++) {
        let k = (t - 1) / 2, row = t % 2 === 1 && k < pids.length ? pids[k] : 0;
        embx.set(this.emb.subarray(row * CH, row * CH + CH), t * CH);
      }
      let tx = Math.min(pids.length * 2 + 1, MAX_TEXT), tmask = new Float32Array(MAX_TEXT);
      for (let t = 0; t < tx; t++) tmask[t] = 1;
      let t0 = performance.now(), embT = Tensor.fromTypedArray(embx, [1, MAX_TEXT, CH]), tmT = Tensor.fromTypedArray(tmask, [1, 1, MAX_TEXT]), teOuts = await this.m.textenc.run([embT, tmT]), teBufs = [];
      for (let o of teOuts) teBufs.push(await o.data());
      for (let o of teOuts) o.delete();
      embT.delete(), tmT.delete();
      let [mu, logw] = teBufs[0].length === F * MAX_TEXT ? [teBufs[0], teBufs[1]] : [teBufs[1], teBufs[0]];
      timings.textenc += performance.now() - t0;
      let cum = new Float64Array(MAX_TEXT), acc = 0;
      for (let t = 0; t < MAX_TEXT; t++)
        acc += Math.ceil(Math.exp(logw[t]) * tmask[t]) * length_scale, cum[t] = acc;
      let ylen = Math.min(Math.max(Math.trunc(acc), 1), MAX_MEL), muY = new Float32Array(F * MAX_MEL), p = 0;
      for (let f = 0; f < ylen; f++) {
        for (; p < MAX_TEXT - 1 && cum[p] <= f; ) p++;
        for (let c = 0; c < F; c++) muY[c * MAX_MEL + f] = mu[c * MAX_TEXT + p];
      }
      let ymask = new Float32Array(MAX_MEL);
      for (let f = 0; f < ylen; f++) ymask[f] = 1;
      let randn = makeRandn(seed), x = new Float32Array(F * MAX_MEL);
      for (let c = 0; c < F; c++)
        for (let f = 0; f < ylen; f++) x[c * MAX_MEL + f] = randn();
      let dt = 1 / steps;
      t0 = performance.now();
      for (let s = 0; s < steps; s++) {
        let xT = Tensor.fromTypedArray(x, [1, F, MAX_MEL]), muT = Tensor.fromTypedArray(muY, [1, F, MAX_MEL]), tsT = Tensor.fromTypedArray(sinPosEmb(s / steps, TDIM), [1, TDIM]), ymT = Tensor.fromTypedArray(ymask, [1, 1, MAX_MEL]), outs = await this.m.decoder.run([xT, muT, tsT, ymT]), v = await outs[0].data();
        for (let o of outs) o.delete();
        xT.delete(), muT.delete(), tsT.delete(), ymT.delete();
        for (let i = 0; i < x.length; i++) x[i] += dt * v[i];
      }
      timings.decoder += performance.now() - t0;
      let mel = new Float32Array(F * MAX_MEL);
      for (let c = 0; c < F; c++)
        for (let f = 0; f < ylen; f++)
          mel[c * MAX_MEL + f] = x[c * MAX_MEL + f] * mel_std + mel_mean;
      t0 = performance.now();
      let wav = await this.vocode(mel, ylen);
      return timings.vocoder += performance.now() - t0, { wav, ylen, mel, timings };
    }
    /** mel [1,80,MAX_MEL] → trimmed, clipped waveform (ylen·hop samples). */
    async vocode(mel, ylen, model = this.m.vocoder) {
      let { MAX_MEL, n_feats: F, hop } = this.cfg, melT = Tensor.fromTypedArray(mel, [1, F, MAX_MEL]), outs = await model.run([melT]), wavFull = await outs[0].data();
      for (let o of outs) o.delete();
      melT.delete();
      let n = ylen * hop, wav = new Float32Array(n);
      for (let i = 0; i < n; i++) wav[i] = Math.max(-1, Math.min(1, wavFull[i]));
      return wav;
    }
  };

  // src/offscreen/main.js
  var HF = "https://huggingface.co/litert-community/Matcha-TTS/resolve/main/", FILES = {
    textenc: "matcha_textenc_fp16.tflite",
    decoder: "matcha_decoder_fp16.tflite",
    vocoder: "matcha_vocoder_fp16.tflite",
    g2p: "dp_g2p_matcha_fp16.tflite",
    emb: "emb.bin",
    dict: "g2p_dict.txt.gz",
    config: "config.json",
    g2pMeta: "g2p_meta.json"
  }, CACHE_NAME = "page-voice-models-v1", STEPS = 4, SEED = 0, state = "loading", error = null, backends = null, wasmOpts = null, g2p = null, synth = null, cfg = null, symToId = null, audioCtx = null, playCursor = null, liveSources = [], queue = [], processing = !1, generation = 0, lastStats = null, downloadedMB = 0, spokenCount = 0;
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!(!msg || msg.target !== "offscreen"))
      return msg.type === "speak" ? (enqueue(msg.text), sendResponse({ ok: !0 })) : msg.type === "stop" ? (stopAll(), sendResponse({ ok: !0 })) : msg.type === "status" && sendResponse(statusPayload()), !1;
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
    return backends ? backends.textenc === "webgpu" || backends.vocoder === "webgpu" ? "webgpu+wasm" : wasmOpts?.threads ? "wasm" : "wasm\xB71-thread" : null;
  }
  var lastBroadcast = 0;
  function broadcast(force = !1) {
    let now = performance.now();
    !force && now - lastBroadcast < 250 || (lastBroadcast = now, chrome.runtime.sendMessage(statusPayload()).catch(() => {
    }));
  }
  async function fetchCached(name, onProgress) {
    let url = HF + name, cache = "caches" in globalThis ? await caches.open(CACHE_NAME) : null;
    if (cache) {
      let hit = await cache.match(url);
      if (hit) {
        let bytes2 = new Uint8Array(await hit.arrayBuffer());
        return onProgress?.(bytes2.length), bytes2;
      }
    }
    let response = await fetch(url);
    if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
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
  async function gunzip(bytes) {
    if (bytes[0] !== 31 || bytes[1] !== 139) return bytes;
    let ds = new DecompressionStream("gzip"), stream = new Blob([bytes]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  function parseDict(bytes) {
    let text = new TextDecoder().decode(bytes), dict = /* @__PURE__ */ new Map(), start = 0;
    for (; start < text.length; ) {
      let end = text.indexOf(`
`, start);
      end === -1 && (end = text.length);
      let tab = text.indexOf("	", start);
      tab > start && tab < end && dict.set(text.slice(start, tab), text.slice(tab + 1, end)), start = end + 1;
    }
    return dict;
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
      let gpu = isWebGPUSupported() ? "webgpu" : "wasm";
      backends = { g2p: "wasm", textenc: gpu, decoder: "wasm", vocoder: gpu }, state = "downloading", broadcast(!0);
      let progress = {}, grab = (name) => fetchCached(FILES[name], (received) => {
        progress[name] = received;
        let done = 0;
        for (let k in progress) done += progress[k];
        downloadedMB = Math.round(done / 1048576), broadcast();
      }), [teB, deB, voB, g2pB, embB, dictB, cfgB, metaB] = await Promise.all([
        grab("textenc"),
        grab("decoder"),
        grab("vocoder"),
        grab("g2p"),
        grab("emb"),
        grab("dict"),
        grab("config"),
        grab("g2pMeta")
      ]);
      state = "compiling", broadcast(!0), cfg = JSON.parse(new TextDecoder().decode(cfgB));
      let meta = JSON.parse(new TextDecoder().decode(metaB));
      symToId = /* @__PURE__ */ new Map(), cfg.symbols.forEach((s, i) => {
        s.length === 1 && symToId.set(s, i);
      });
      let dict = parseDict(await gunzip(dictB)), emb = new Float32Array(embB.buffer, embB.byteOffset, embB.byteLength / 4), wasmCompile = { accelerator: "wasm", cpuOptions: { numThreads: Math.min(8, navigator.hardwareConcurrency || 4) } }, models = {};
      for (let [key, bytes] of [["textenc", teB], ["decoder", deB], ["vocoder", voB], ["g2p", g2pB]]) {
        if (backends[key] === "wasm") {
          models[key] = await loadAndCompile(bytes, wasmCompile);
          continue;
        }
        try {
          models[key] = await loadAndCompile(bytes, { accelerator: backends[key] });
        } catch {
          backends[key] = "wasm", models[key] = await loadAndCompile(bytes, wasmCompile);
        }
      }
      g2p = new G2P(dict, meta, models.g2p), synth = new Synthesizer(models, emb, cfg), state = "ready", broadcast(!0), processQueue();
    } catch (err) {
      state = "error", error = String(err instanceof Error ? err.message : err), broadcast(!0);
    }
  }
  function enqueue(text) {
    text = (text ?? "").trim(), text && (spokenCount++, queue.push(text), broadcast(!0), processQueue());
  }
  function stopAll() {
    generation++, queue = [];
    for (let src of liveSources)
      try {
        src.stop();
      } catch {
      }
    liveSources = [], playCursor = null, broadcast(!0);
  }
  async function processQueue() {
    if (!(processing || state !== "ready")) {
      processing = !0;
      try {
        for (audioCtx ??= new AudioContext({ sampleRate: cfg.sample_rate }), audioCtx.state === "suspended" && (await audioCtx.resume().catch(() => {
        }), audioCtx.state === "suspended" && (error = "AudioContext suspended \u2014 autoplay blocked in offscreen document", broadcast(!0))); queue.length; ) {
          let gen = generation, text = queue.shift();
          broadcast(!0), await speakText(text, gen);
        }
      } finally {
        processing = !1, broadcast(!0);
      }
    }
  }
  async function speakText(text, gen) {
    let t0 = performance.now(), chunks = await phonemize(g2p, symToId, text), tG2p = performance.now() - t0;
    if (!chunks.length) return;
    let timings = { g2p: tG2p, textenc: 0, decoder: 0, vocoder: 0 }, audioSeconds = 0;
    for (let chunk of chunks) {
      if (gen !== generation) return;
      let r = await synth.run(chunk.ids, { steps: STEPS, seed: SEED });
      if (gen !== generation) return;
      for (let k of ["textenc", "decoder", "vocoder"]) timings[k] += r.timings[k];
      audioSeconds += r.wav.length / cfg.sample_rate, playWav(r.wav);
      let totalMs = timings.g2p + timings.textenc + timings.decoder + timings.vocoder;
      lastStats = {
        totalMs: +totalMs.toFixed(0),
        audioSeconds: +audioSeconds.toFixed(1),
        rtf: +(totalMs / 1e3 / audioSeconds).toFixed(2),
        steps: STEPS
      }, broadcast(!0);
    }
  }
  function playWav(wav) {
    let buf = audioCtx.createBuffer(1, wav.length, cfg.sample_rate);
    buf.copyToChannel(wav, 0);
    let src = audioCtx.createBufferSource();
    src.buffer = buf, src.connect(audioCtx.destination);
    let at = Math.max(playCursor ?? 0, audioCtx.currentTime + 0.05);
    src.start(at), playCursor = at + buf.duration, liveSources.push(src), src.onended = () => {
      liveSources = liveSources.filter((s) => s !== src), broadcast();
    };
  }
  boot();
})();
