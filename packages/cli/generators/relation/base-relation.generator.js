// Copyright IBM Corp. and LoopBack contributors 2019,2020. All Rights Reserved.
// Node module: @loopback/cli
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

const ast = require('ts-morph');
const ArtifactGenerator = require('../../lib/artifact-generator');
const path = require('path');
const relationUtils = require('./utils.generator');
const utils = require('../../lib/utils');

module.exports = class BaseRelationGenerator extends ArtifactGenerator {
  constructor(args, opts) {
    super(args, opts);
  }

  _setupGenerator() {
    this.artifactInfo = {
      type: 'relation',
      rootDir: utils.sourceRootDir,
    };

    this.artifactInfo.outDir = path.resolve(
      this.artifactInfo.rootDir,
      'controllers',
    );
    this.artifactInfo.modelDir = path.resolve(
      this.artifactInfo.rootDir,
      'models',
    );
    this.artifactInfo.repositoryDir = path.resolve(
      this.artifactInfo.rootDir,
      'repositories',
    );

    super._setupGenerator();
  }

  async generateAll(options) {
    this._setupGenerator();
    await this.generateModels(options);
    this._setupGenerator();
    await this.generateRepositories(options);
    this._setupGenerator();
    await this.generateControllers(options);
  }

  async generateControllers(options) {
    /* istanbul ignore next */
    throw new Error('Not implemented');
  }

  async generateModels(options) {
    /* istanbul ignore next */
    throw new Error('Not implemented');
  }

  async generateRepositories(options) {
    this._initializeProperties(options);
    this._addImportsToRepository(options);
    this._addPropertyToRepository(options);
    const classDeclaration = relationUtils.getClassObj(
      this.artifactInfo.srcRepositoryFileObj,
      this.artifactInfo.srcRepositoryClassName,
    );
    const classConstructor =
      relationUtils.getClassConstructor(classDeclaration);
    this._addParametersToRepositoryConstructor(classConstructor);
    this._addCreatorToRepositoryConstructor(classConstructor);
    this._registerInclusionResolverForRelation(classConstructor, options);
    await this.artifactInfo.srcRepositoryFileObj.save();
  }

  _addImportsToRepository(options) {
    const imports = this._getRepositoryRequiredImports(
      options.destinationModel,
      this.artifactInfo.dstRepositoryClassName,
      this.artifactInfo.isPolymorphic,
    );

    relationUtils.addRequiredImports(
      this.artifactInfo.srcRepositoryFileObj,
      imports,
    );
  }

  _addPropertyToRepository(options) {
    const classDeclaration =
      this.artifactInfo.srcRepositoryFileObj.getClassOrThrow(
        this.artifactInfo.srcRepositoryClassName,
      );

    const property = {
      scope: ast.Scope.Public,
      isReadonly: true,
      name: this._getRepositoryRelationPropertyName(),
      type: this._getRepositoryRelationPropertyType(),
    };

    // already checked the existence of property before
    relationUtils.addProperty(classDeclaration, property);
  }

  _addParametersToRepositoryConstructor(classConstructor) {
    if (this.artifactInfo.isPolymorphic) {
      for (const submodel of this.artifactInfo.polymorphicSubclasses) {
        if (this._addThroughRepoToRepositoryConstructor) {
          this._addThroughRepoToRepositoryConstructor(classConstructor);
        }
        const parameterName =
          utils.camelCase(utils.toClassName(submodel) + 'Repository') +
          'Getter';

        if (relationUtils.doesParameterExist(classConstructor, parameterName)) {
          // no need to check if the getter already exists
          return;
        }
        classConstructor.addParameter({
          decorators: [
            {
              name: 'repository.getter',
              arguments: [
                "'" + utils.toClassName(submodel) + 'Repository' + "'",
              ],
            },
          ],
          name: parameterName,
          type: `Getter<EntityCrudRepository<${this.artifactInfo.dstModelClass}, typeof ${this.artifactInfo.dstModelClass}.prototype.id, ${this.artifactInfo.dstModelClass}Relations>>,`,
          scope: ast.Scope.Protected,
        });
      }
    } else {
      if (this._addThroughRepoToRepositoryConstructor) {
        this._addThroughRepoToRepositoryConstructor(classConstructor);
      }
      const parameterName =
        utils.camelCase(this.artifactInfo.dstRepositoryClassName) + 'Getter';

      if (relationUtils.doesParameterExist(classConstructor, parameterName)) {
        // no need to check if the getter already exists
        return;
      }

      classConstructor.addParameter({
        decorators: [
          {
            name: 'repository.getter',
            arguments: ["'" + this.artifactInfo.dstRepositoryClassName + "'"],
          },
        ],
        name: parameterName,
        type: 'Getter<' + this.artifactInfo.dstRepositoryClassName + '>,',
        scope: ast.Scope.Protected,
      });
    }
  }

  _addCreatorToRepositoryConstructor(classConstructor) {
    /* istanbul ignore next */
    throw new Error('Not implemented');
  }

  _registerInclusionResolverForRelation(classConstructor, options) {
    /* istanbul ignore next */
    throw new Error('Not implemented');
  }

  _initializeProperties(options) {
    // src configuration.
    this.artifactInfo.srcModelPrimaryKey = options.sourceModelPrimaryKey;
    this.artifactInfo.srcModelFile = path.resolve(
      this.artifactInfo.modelDir,
      utils.getModelFileName(options.sourceModel),
    );

    this.artifactInfo.srcModelClass = options.sourceModel;

    this.artifactInfo.srcRepositoryFile = path.resolve(
      this.artifactInfo.repositoryDir,
      utils.getRepositoryFileName(options.sourceModel),
    );

    this.artifactInfo.srcRepositoryClassName =
      utils.toClassName(options.sourceModel) + 'Repository';

    this.artifactInfo.srcRepositoryFileObj =
      new relationUtils.AstLoopBackProject().addSourceFileAtPath(
        this.artifactInfo.srcRepositoryFile,
      );

    // dst configuration
    this.artifactInfo.dstModelFile = path.resolve(
      this.artifactInfo.modelDir,
      utils.getModelFileName(options.destinationModel),
    );

    this.artifactInfo.dstModelClass = options.destinationModel;

    this.artifactInfo.dstRepositoryFile = path.resolve(
      this.artifactInfo.repositoryDir,
      utils.getRepositoryFileName(options.destinationModel),
    );

    this.artifactInfo.dstRepositoryClassName =
      utils.toClassName(options.destinationModel) + 'Repository';
    this.artifactInfo.dstModelPrimaryKey = options.destinationModelPrimaryKey;
    if (options.throughModel) {
      this.artifactInfo.throughModelClass = options.throughModel;
      this.artifactInfo.throughRepoClassName = utils.toClassName(
        options.throughModel + 'Repository',
      );
    }

    // relation configuration
    this.artifactInfo.relationName = options.relationName;

    this.artifactInfo.isPolymorphic = options.isPolymorphic;
    this.artifactInfo.polymorphicDiscriminator =
      options.polymorphicDiscriminator;
    this.artifactInfo.polymorphicSubclasses = options.polymorphicSubclasses;
  }

  _getRepositoryRequiredImports(
    dstModelClassName,
    dstRepositoryClassName,
    isPolymorphic,
  ) {
    const importsArray = [
      {
        name: dstModelClassName,
        module: '../models',
      },
      {
        name: 'repository',
        module: '@loopback/repository',
      },
      {
        name: 'Getter',
        module: '@loopback/core',
      },
    ];
    if (isPolymorphic) {
      importsArray.push(
        ...[
          {
            name: dstModelClassName + 'Relations',
            module: '../models',
          },
          {
            name: 'EntityCrudRepository',
            module: '@loopback/repository',
          },
        ],
      );
    } else {
      importsArray.push({
        name: dstRepositoryClassName,
        module: `./${utils.toFileName(dstModelClassName)}.repository`,
      });
    }
    return importsArray;
  }

  _getRepositoryRelationPropertyName() {
    /* istanbul ignore next */
    throw new Error('Not implemented');
  }

  _getRepositoryRelationPropertyType() {
    /* istanbul ignore next */
    throw new Error('Not implemented');
  }
};
