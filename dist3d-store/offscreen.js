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
    constructor(model2, liteRtCompiledModel, options, onDelete) {
      this.model = model2, this.liteRtCompiledModel = liteRtCompiledModel, this.options = options, this.onDelete = onDelete;
      let numSignatures = model2.liteRtModel.getNumSignatures(), compiledModelSignatureRunners = {};
      for (let i = 0; i < numSignatures; i++) {
        let compiledModelSignatureRunner = new CompiledModelSignatureRunner(
          i,
          model2.liteRtModel,
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
  function loadAndCompile(model2, compileOptions) {
    return getGlobalLiteRt().loadAndCompile(model2, compileOptions);
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
    async loadAndCompile(model2, compileOptions = {}) {
      let modelData;
      if (typeof model2 == "string" || model2 instanceof URL)
        modelData = await urlToUint8Array(model2);
      else if (model2 instanceof Uint8Array)
        modelData = model2;
      else if (model2 instanceof ReadableStreamDefaultReader)
        modelData = await readableStreamDefaultReaderToUint8Array(model2);
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

  // src3d/offscreen/main.js
  var MODEL_URL = "https://huggingface.co/litert-community/MoGe-2-LiteRT/resolve/main/moge.tflite", CACHE_NAME = "page3d-models-v1", SIZE = 448, MASK_THRESHOLD = 0.5, DISP_MIN = 0.5, DISP_MAX = 2.2, RANGE_TARGET = 2, RANGE_FLAT = 1.06, GAMMA_MAX = 3, PHOTO_MAX_SIDE = 1024, CACHE_ENTRIES = 8, state = "loading", error = null, backend = null, wasmOpts = null, model = null, downloadedMB = 0, lastStats = null, runCount = 0, lastResult = null, resultCache = /* @__PURE__ */ new Map();
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!(!msg || msg.target !== "offscreen"))
      return msg.type === "depth" ? (requestDepth(msg.url).then(sendResponse), !0) : (msg.type === "status" && sendResponse(statusPayload()), !1);
  });
  function statusPayload() {
    return {
      target: "ui",
      type: "status",
      state,
      error,
      env: backend === "webgpu" ? "webgpu" : wasmOpts?.threads ? "wasm" : "wasm\xB71-thread",
      backend,
      flags: {
        webgpu: backend ? backend === "webgpu" : null,
        threads: wasmOpts?.threads ?? null,
        jspi: wasmOpts?.jspi ?? null,
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
      backend = isWebGPUSupported() ? "webgpu" : "wasm", state = "downloading", broadcast(!0);
      let bytes = await fetchCached(MODEL_URL, (received) => {
        downloadedMB = Math.round(received / 1048576), broadcast();
      });
      state = "compiling", broadcast(!0);
      let wasmCompile = { accelerator: "wasm", cpuOptions: { numThreads: Math.min(8, navigator.hardwareConcurrency || 4) } };
      if (backend === "wasm")
        model = await loadAndCompile(bytes, wasmCompile);
      else
        try {
          model = await loadAndCompile(bytes, { accelerator: "webgpu" });
        } catch {
          backend = "wasm", model = await loadAndCompile(bytes, wasmCompile);
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
  var cropCanvas = new OffscreenCanvas(SIZE, SIZE), cropCtx = cropCanvas.getContext("2d", { willReadFrequently: !0 });
  function preprocess(bitmap) {
    let scale = Math.min(SIZE / bitmap.width, SIZE / bitmap.height), drawW = Math.round(bitmap.width * scale), drawH = Math.round(bitmap.height * scale), offX = Math.floor((SIZE - drawW) / 2), offY = Math.floor((SIZE - drawH) / 2);
    cropCtx.fillStyle = "#7f7f7f", cropCtx.fillRect(0, 0, SIZE, SIZE), cropCtx.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height, offX, offY, drawW, drawH);
    let { data } = cropCtx.getImageData(0, 0, SIZE, SIZE), plane = SIZE * SIZE, nchw = new Float32Array(3 * plane);
    for (let i = 0; i < plane; i++)
      nchw[i] = data[i * 4] / 255, nchw[plane + i] = data[i * 4 + 1] / 255, nchw[2 * plane + i] = data[i * 4 + 2] / 255;
    return { nchw, rect: { offX, offY, drawW, drawH } };
  }
  function sampleAbsMax(array) {
    let max = 0, step = Math.max(1, Math.floor(array.length / 5e3));
    for (let i = 0; i < array.length; i += step) {
      let v = Math.abs(array[i]);
      v > max && (max = v);
    }
    return max;
  }
  function resolveOutputs(buffers) {
    let plane = SIZE * SIZE, big = buffers.filter((b) => b.length === plane * 3), mask = buffers.find((b) => b.length === plane);
    if (big.length !== 2 || !mask) throw new Error("unexpected model outputs");
    let pointsFirst = sampleAbsMax(big[0]) > 2;
    return {
      points: pointsFirst ? big[0] : big[1],
      normals: pointsFirst ? big[1] : big[0],
      mask
    };
  }
  async function infer(nchw) {
    let input = Tensor.fromTypedArray(nchw, [1, 3, SIZE, SIZE]), start = performance.now(), outputs = await model.run([input]), buffers = [];
    for (let output of outputs) buffers.push(await output.data());
    let inferMs = performance.now() - start;
    for (let output of outputs) output.delete();
    return input.delete(), { ...resolveOutputs(buffers), inferMs };
  }
  function packDepth(points, mask, rect) {
    let { offX, offY, drawW, drawH } = rect, depths = [];
    for (let y = offY; y < offY + drawH; y += 2)
      for (let x = offX; x < offX + drawW; x += 2) {
        let i = y * SIZE + x, d = points[i * 3 + 2];
        mask[i] > MASK_THRESHOLD && Number.isFinite(d) && d > 0 && depths.push(d);
      }
    if (depths.length < 32) throw new Error("no confident depth in this image");
    depths.sort((a, b) => a - b);
    let median = depths[depths.length >> 1], p05 = depths[Math.floor(depths.length * 0.05)], ratio = depths[Math.min(depths.length - 1, Math.floor(depths.length * 0.95))] / Math.max(p05, 1e-6), gamma = 1;
    ratio > RANGE_FLAT && ratio < RANGE_TARGET && (gamma = Math.min(GAMMA_MAX, Math.log(RANGE_TARGET) / Math.log(ratio)));
    let out = new ImageData(drawW, drawH), px = out.data, validCount = 0, nMin = 1, nMax = 0;
    for (let y = 0; y < drawH; y++)
      for (let x = 0; x < drawW; x++) {
        let i = (y + offY) * SIZE + (x + offX), d = points[i * 3 + 2], valid = mask[i] > MASK_THRESHOLD && Number.isFinite(d) && d > 0, n = 0;
        valid && (n = (Math.min(DISP_MAX, Math.max(DISP_MIN, (median / d) ** gamma)) - DISP_MIN) / (DISP_MAX - DISP_MIN), validCount++, n < nMin && (nMin = n), n > nMax && (nMax = n));
        let v = Math.round(n * 65535), o = (y * drawW + x) * 4;
        px[o] = v >> 8, px[o + 1] = v & 255, px[o + 2] = valid ? 255 : 0, px[o + 3] = 255;
      }
    return {
      imageData: out,
      stats: {
        validRatio: +(validCount / (drawW * drawH)).toFixed(3),
        nMin: +nMin.toFixed(3),
        nMax: +nMax.toFixed(3),
        dispRatio: +ratio.toFixed(2),
        gamma: +gamma.toFixed(2)
      }
    };
  }
  function packNormals(normals, mask, rect) {
    let { offX, offY, drawW, drawH } = rect, out = new ImageData(drawW, drawH), px = out.data, sumZ = 0, sumLen = 0, count = 0;
    for (let y = 0; y < drawH; y++)
      for (let x = 0; x < drawW; x++) {
        let i = (y + offY) * SIZE + (x + offX), nx = normals[i * 3], ny = normals[i * 3 + 1], nz = normals[i * 3 + 2], len = Math.hypot(nx, ny, nz), valid = mask[i] > MASK_THRESHOLD && len > 0.5 && len < 1.5, o = (y * drawW + x) * 4;
        valid ? (px[o] = Math.round((nx / len * 0.5 + 0.5) * 255), px[o + 1] = Math.round((ny / len * 0.5 + 0.5) * 255), px[o + 2] = Math.round((nz / len * 0.5 + 0.5) * 255), sumZ += nz / len, sumLen += len, count++) : (px[o] = 128, px[o + 1] = 128, px[o + 2] = 0), px[o + 3] = 255;
      }
    return {
      imageData: out,
      stats: {
        normalMeanZ: count ? +(sumZ / count).toFixed(3) : null,
        normalMeanLen: count ? +(sumLen / count).toFixed(3) : null
      }
    };
  }
  async function canvasToDataUrl(imageDataOrBitmap, type, quality) {
    let w = imageDataOrBitmap.width, h = imageDataOrBitmap.height, canvas = new OffscreenCanvas(w, h), ctx = canvas.getContext("2d");
    imageDataOrBitmap instanceof ImageData ? ctx.putImageData(imageDataOrBitmap, 0, 0) : ctx.drawImage(imageDataOrBitmap, 0, 0, w, h);
    let blob = await canvas.convertToBlob({ type, quality });
    return new Promise((resolve, reject) => {
      let reader = new FileReader();
      reader.onload = () => resolve(reader.result), reader.onerror = reject, reader.readAsDataURL(blob);
    });
  }
  async function encodePhoto(bitmap) {
    let scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(bitmap.width, bitmap.height)), w = Math.max(1, Math.round(bitmap.width * scale)), h = Math.max(1, Math.round(bitmap.height * scale)), canvas = new OffscreenCanvas(w, h);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);
    let blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.88 });
    return { url: await new Promise((resolve, reject) => {
      let reader = new FileReader();
      reader.onload = () => resolve(reader.result), reader.onerror = reject, reader.readAsDataURL(blob);
    }), w, h };
  }
  var chain = Promise.resolve();
  function requestDepth(url, opts) {
    let run = chain.then(() => runDepth(url, opts)).catch((err) => ({
      ok: !1,
      error: String(err instanceof Error ? err.message : err)
    }));
    return chain = run.then(() => {
    }), run;
  }
  async function runDepth(url, { forceRelay = !1 } = {}) {
    if (state !== "ready") {
      let deadline = Date.now() + 3e5;
      for (; state !== "ready" && state !== "error" && Date.now() < deadline; )
        await new Promise((r) => setTimeout(r, 300));
      if (state !== "ready") return { ok: !1, error: error ?? "engine not ready" };
    }
    let cached = resultCache.get(url);
    if (cached && !forceRelay)
      return resultCache.delete(url), resultCache.set(url, cached), cached;
    let { bytes, via, fetchMs } = await fetchImageBytes(url, { forceRelay }), bitmap = await createImageBitmap(new Blob([bytes]), { imageOrientation: "from-image" }), { nchw, rect } = preprocess(bitmap), { points, normals, mask, inferMs } = await infer(nchw), { imageData, stats: depthStats } = packDepth(points, mask, rect), depthUrl = await canvasToDataUrl(imageData, "image/png"), packedNormals = packNormals(normals, mask, rect), normalUrl = await canvasToDataUrl(packedNormals.imageData, "image/png"), photo = await encodePhoto(bitmap);
    bitmap.close(), runCount++, lastStats = {
      fetchMs: +fetchMs.toFixed(0),
      inferMs: +inferMs.toFixed(0),
      via,
      ...depthStats,
      ...packedNormals.stats
    }, broadcast(!0);
    let payload = {
      ok: !0,
      depth: { url: depthUrl, w: imageData.width, h: imageData.height },
      normal: { url: normalUrl, w: imageData.width, h: imageData.height },
      photo,
      stats: { ...lastStats, backend, env: statusPayload().env }
    };
    return lastResult = payload, resultCache.set(url, payload), resultCache.size > CACHE_ENTRIES && resultCache.delete(resultCache.keys().next().value), payload;
  }
  boot();
})();
