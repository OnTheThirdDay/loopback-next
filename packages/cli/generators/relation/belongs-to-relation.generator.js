// Copyright IBM Corp. and LoopBack contributors 2019,2020. All Rights Reserved.
// Node module: @loopback/cli
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

const path = require('path');
const BaseRelationGenerator = require('./base-relation.generator');
const utils = require('../../lib/utils');
const relationUtils = require('./utils.generator');

const CONTROLLER_TEMPLATE_PATH_BELONGS_TO =
  'controller-relation-template-belongs-to.ts.ejs';

module.exports = class BelongsToRelationGenerator extends (
  BaseRelationGenerator
) {
  constructor(args, opts) {
    super(args, opts);
  }

  async generateControllers(options) {
    this.artifactInfo.sourceModelPrimaryKey = options.sourceModelPrimaryKey;
    this.artifactInfo.sourceModelPrimaryKeyType =
      options.sourceModelPrimaryKeyType;
    this.artifactInfo.sourceModelClassName = options.sourceModel;
    this.artifactInfo.targetModelClassName = options.destinationModel;
    this.artifactInfo.paramTargetModel = utils.camelCase(
      options.destinationModel,
    );
    this.artifactInfo.sourceRepositoryClassName =
      this.artifactInfo.sourceModelClassName + 'Repository';
    this.artifactInfo.controllerClassName =
      this.artifactInfo.sourceModelClassName +
      this.artifactInfo.targetModelClassName +
      'Controller';

    this.artifactInfo.paramSourceRepository = utils.camelCase(
      this.artifactInfo.sourceModelClassName + 'Repository',
    );

    this.artifactInfo.sourceModelName = utils.toFileName(options.sourceModel);
    this.artifactInfo.sourceModelPath = utils.pluralize(
      this.artifactInfo.sourceModelName,
    );
    this.artifactInfo.targetModelName = utils.toFileName(
      options.destinationModel,
    );

    this.artifactInfo.relationPropertyName = options.relationName;
    this.artifactInfo.targetModelPrimaryKey =
      options.destinationModelPrimaryKey;
    this.artifactInfo.targetModelPrimaryKeyType =
      options.destinationModelPrimaryKeyType;

    const source = this.templatePath(CONTROLLER_TEMPLATE_PATH_BELONGS_TO);

    this.artifactInfo.name =
      options.sourceModel + '-' + options.destinationModel;
    this.artifactInfo.outFile =
      utils.toFileName(this.artifactInfo.name) + '.controller.ts';

    const dest = this.destinationPath(
      path.join(this.artifactInfo.outDir, this.artifactInfo.outFile),
    );

    this.copyTemplatedFiles(source, dest, this.artifactInfo);
    await relationUtils.addExportController(
      this,
      path.resolve(this.artifactInfo.outDir, 'index.ts'),
      this.artifactInfo.controllerClassName,
      utils.toFileName(this.artifactInfo.name) + '.controller',
    );
  }

  async generateModels(options) {
    // for repo to generate relation name
    this.artifactInfo.relationName = options.relationName;
    const modelDir = this.artifactInfo.modelDir;
    const sourceModel = options.sourceModel;

    const targetModel = options.destinationModel;
    const relationType = options.relationType;
    const relationName = options.relationName;
    const defaultRelationName = options.defaultRelationName;
    const foreignKeyName = options.foreignKeyName;
    const fktype = options.destinationModelPrimaryKeyType;

    const project = new relationUtils.AstLoopBackProject();
    const sourceFile = relationUtils.addFileToProject(
      project,
      modelDir,
      sourceModel,
    );
    const sourceClass = relationUtils.getClassObj(sourceFile, sourceModel);
    // this checks if the foreign key already exists, so the 2nd param should be foreignKeyName
    relationUtils.doesRelationExist(sourceClass, foreignKeyName);

    const isPolymorphic = options.isPolymorphic;
    const discriminatorName = options.polymorphicDiscriminator;
    const isDefaultDiscriminator =
      discriminatorName === utils.camelCase(options.relationName) + 'Type';

    const modelProperty = this.getBelongsTo(
      targetModel,
      relationName,
      defaultRelationName,
      foreignKeyName,
      fktype,
      isPolymorphic,
      isDefaultDiscriminator,
      discriminatorName,
    );

    relationUtils.addProperty(sourceClass, modelProperty);

    if (isPolymorphic) {
      relationUtils.addProperty(sourceClass, {
        name: discriminatorName,
        type: 'string',
      });
    }

    const imports = relationUtils.getRequiredImports(targetModel, relationType);
    relationUtils.addRequiredImports(sourceFile, imports);

    sourceClass.formatText();
    await sourceFile.save();
  }

  getBelongsTo(
    className,
    relationName,
    defaultRelationName,
    foreignKeyName,
    fktype,
    isPolymorphic,
    isDefaultDiscriminator,
    discriminatorName,
  ) {
    const polymorphicTypeArg = isPolymorphic
      ? 'polymorphic: ' +
        (isDefaultDiscriminator
          ? 'true'
          : `{discriminator: '${discriminatorName}'}`)
      : '';
    // checks if relation name is customized
    let relationDecorator = [
      {
        name: 'belongsTo',
        arguments: [
          `() =>  ${className}${
            isPolymorphic ? ', {' + polymorphicTypeArg + '}' : ''
          }`,
        ],
      },
    ];
    // already checked if the relation name is the same as the source key before
    if (defaultRelationName !== relationName) {
      relationDecorator = [
        {
          name: 'belongsTo',
          arguments: [
            `() =>  ${className}, {name: '${relationName}'${
              isPolymorphic ? ', ' + polymorphicTypeArg : ''
            }}`,
          ],
        },
      ];
    }
    return {
      decorators: relationDecorator,
      name: foreignKeyName,
      type: fktype,
    };
  }

  _getRepositoryRequiredImports(
    dstModelClassName,
    dstRepositoryClassName,
    isPolymorphic,
  ) {
    const importsArray = super._getRepositoryRequiredImports(
      dstModelClassName,
      dstRepositoryClassName,
      isPolymorphic,
    );
    importsArray.push({
      name: 'BelongsToAccessor',
      module: '@loopback/repository',
    });
    return importsArray;
  }

  _getRepositoryRelationPropertyName() {
    return this.artifactInfo.relationName;
  }

  _initializeProperties(options) {
    super._initializeProperties(options);
    this.artifactInfo.dstModelPrimaryKey = options.destinationModelPrimaryKey;
  }

  _getRepositoryRelationPropertyType() {
    return (
      `BelongsToAccessor<` +
      `${utils.toClassName(this.artifactInfo.dstModelClass)}` +
      `, typeof ${utils.toClassName(this.artifactInfo.srcModelClass)}` +
      `.prototype.${this.artifactInfo.srcModelPrimaryKey}>`
    );
  }

  _addCreatorToRepositoryConstructor(classConstructor) {
    const relationName = this.artifactInfo.relationName;
    if (this.artifactInfo.isPolymorphic) {
      let getters = '{';
      for (const submodel of this.artifactInfo.polymorphicSubclasses) {
        getters =
          getters +
          `"${submodel}": ${utils.camelCase(
            utils.toClassName(submodel) + 'Repository',
          )}Getter, `;
      }
      getters = getters + '}';
      const statement =
        `this.${relationName} = ` +
        `this.createBelongsToAccessorFor('${relationName}', ` +
        `${getters});`;
      classConstructor.insertStatements(1, statement);
    } else {
      const statement =
        `this.${relationName} = ` +
        `this.createBelongsToAccessorFor('` +
        `${relationName}',` +
        ` ${utils.camelCase(this.artifactInfo.dstRepositoryClassName)}` +
        `Getter,);`;
      classConstructor.insertStatements(1, statement);
    }
  }

  _registerInclusionResolverForRelation(classConstructor, options) {
    const relationName = this.artifactInfo.relationName;
    if (options.registerInclusionResolver) {
      const statement =
        `this.registerInclusionResolver(` +
        `'${relationName}', this.${relationName}.inclusionResolver);`;
      classConstructor.insertStatements(2, statement);
    }
  }
};
